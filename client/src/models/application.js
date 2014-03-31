(function () {

    _kiwi.model.Application = Backbone.Model.extend({
        /** _kiwi.view.Application */
        view: null,

        /** _kiwi.view.StatusMessage */
        message: null,

        /* Address for the kiwi server */
        kiwi_server: null,

        initialize: function (options) {
            if (options.container) {
                this.set('container', options.container);
            }

            // The base url to the kiwi server
            this.set('base_path', options.base_path ? options.base_path : '/kiwi');

            // Path for the settings.json file
            this.set('settings_path', options.settings_path ?
                    options.settings_path :
                    this.get('base_path') + '/assets/settings.json'
            );

            // Any options sent down from the server
            this.server_settings = options.server_settings || {};
            this.translations = options.translations || {};
            this.themes = options.themes || [];

            // Best guess at where the kiwi server is if not already specified
            this.kiwi_server = options.kiwi_server || this.detectKiwiServer();

            // The applet to initially load
            this.startup_applet_name = options.startup || 'kiwi_startup';

            // Set any default settings before anything else is applied
            if (this.server_settings && this.server_settings.client && this.server_settings.client.settings) {
                this.applyDefaultClientSettings(this.server_settings.client.settings);
            }
        },


        start: function () {
            // Set the gateway up
            _kiwi.gateway = new _kiwi.model.Gateway();
            this.bindGatewayCommands(_kiwi.gateway);

            this.initializeClient();
            this.initializeGlobals();

            this.view.barsHide(true);

            this.showStartup();
        },


        detectKiwiServer: function () {
            // If running from file, default to localhost:7777 by default
            if (window.location.protocol === 'file:') {
                return 'http://localhost:7778';
            } else {
                // Assume the kiwi server is on the same server
                return window.location.protocol + '//' + window.location.host;
            }
        },


        showStartup: function() {
            this.startup_applet = _kiwi.model.Applet.load(this.startup_applet_name, {no_tab: true});
            this.startup_applet.tab = this.view.$('.console');
            this.startup_applet.view.show();
        },


        initializeClient: function () {
            this.view = new _kiwi.view.Application({model: this, el: this.get('container')});

            // Takes instances of model_network
            this.connections = new _kiwi.model.NetworkPanelList();

            // Applets panel list
            this.applet_panels = new _kiwi.model.PanelList();
            this.applet_panels.view.$el.addClass('panellist applets');
            this.view.$el.find('.tabs').append(this.applet_panels.view.$el);

            /**
             * Set the UI components up
             */
            this.controlbox = new _kiwi.view.ControlBox({el: $('#kiwi .controlbox')[0]});
            this.bindControllboxCommands(this.controlbox);

            this.topicbar = new _kiwi.view.TopicBar({el: this.view.$el.find('.topic')[0]});

            new _kiwi.view.AppToolbar({el: _kiwi.app.view.$el.find('.toolbar .app_tools')[0]});
            new _kiwi.view.ChannelTools({el: _kiwi.app.view.$el.find('.channel_tools')[0]});

            this.message = new _kiwi.view.StatusMessage({el: this.view.$el.find('.status_message')[0]});

            this.resize_handle = new _kiwi.view.ResizeHandler({el: this.view.$el.find('.memberlists_resize_handle')[0]});

            // Rejigg the UI sizes
            this.view.doLayout();
        },


        initializeGlobals: function () {
            _kiwi.global.connections = this.connections;

            _kiwi.global.panels = this.panels;
            _kiwi.global.panels.applets = this.applet_panels;

            _kiwi.global.components.Applet = _kiwi.model.Applet;
            _kiwi.global.components.Panel =_kiwi.model.Panel;
        },


        applyDefaultClientSettings: function (settings) {
            _.each(settings, function (value, setting) {
                if (typeof _kiwi.global.settings.get(setting) === 'undefined') {
                    _kiwi.global.settings.set(setting, value);
                }
            });
        },


        panels: (function() {
            var active_panel;

            var fn = function(panel_type) {
                var panels;

                // Default panel type
                panel_type = panel_type || 'connections';

                switch (panel_type) {
                case 'connections':
                    panels = this.connections.panels();
                    break;
                case 'applets':
                    panels = this.applet_panels.models;
                    break;
                }

                // Active panels / server
                panels.active = active_panel;
                panels.server = this.connections.active_connection ?
                    this.connections.active_connection.panels.server :
                    null;

                return panels;
            };

            _.extend(fn, Backbone.Events);

            // Keep track of the active panel. Channel/query/server or applet
            fn.bind('active', function (new_active_panel) {
                active_panel = new_active_panel;
            });

            return fn;
        })(),


        bindGatewayCommands: function (gw) {
            var that = this;

            gw.on('onconnect', function (event) {
                that.view.barsShow();
            });


            /**
             * Handle the reconnections to the kiwi server
             */
            (function () {
                // 0 = non-reconnecting state. 1 = reconnecting state.
                var gw_stat = 0;

                // If the current or upcoming disconnect was planned
                var unplanned_disconnect = false;

                gw.on('disconnect', function (event) {
                    unplanned_disconnect = !gw.disconnect_requested;

                    if (unplanned_disconnect) {
                        var msg = _kiwi.global.i18n.translate('client_models_application_reconnecting').fetch() + '...';
                        that.message.text(msg, {timeout: 10000});
                    }

                    that.view.$el.removeClass('connected');

                    // Mention the disconnection on every channel
                    _kiwi.app.connections.forEach(function(connection) {
                        connection.panels.server.addMsg('', msg, 'action quit');

                        connection.panels.forEach(function(panel) {
                            if (!panel.isChannel())
                                return;

                            panel.addMsg('', msg, 'action quit');
                        });
                    });

                    gw_stat = 1;
                });


                gw.on('reconnecting', function (event) {
                    var msg = _kiwi.global.i18n.translate('client_models_application_reconnect_in_x_seconds').fetch(event.delay/1000) + '...';

                    // Only need to mention the repeating re-connection messages on server panels
                    _kiwi.app.connections.forEach(function(connection) {
                        connection.panels.server.addMsg('', msg, 'action quit');
                    });
                });


                gw.on('onconnect', function (event) {
                    that.view.$el.addClass('connected');
                    if (gw_stat !== 1) return;

                    if (unplanned_disconnect) {
                        var msg = _kiwi.global.i18n.translate('client_models_application_reconnect_successfully').fetch() + ':)';
                        that.message.text(msg, {timeout: 5000});
                    }

                    // Mention the re-connection on every channel
                    _kiwi.app.connections.forEach(function(connection) {
                        connection.panels.server.addMsg('', msg, 'action join');

                        connection.panels.forEach(function(panel) {
                            if (!panel.isChannel())
                                return;

                            panel.addMsg('', msg, 'action join');
                        });
                    });

                    gw_stat = 0;
                });
            })();


            gw.on('kiwi:reconfig', function () {
                $.getJSON(that.get('settings_path'), function (data) {
                    that.server_settings = data.server_settings || {};
                    that.translations = data.translations || {};
                });
            });


            gw.on('kiwi:jumpserver', function (data) {
                var serv;
                // No server set? Then nowhere to jump to.
                if (typeof data.kiwi_server === 'undefined')
                    return;

                serv = data.kiwi_server;

                // Strip any trailing slash from the end
                if (serv[serv.length-1] === '/')
                    serv = serv.substring(0, serv.length-1);

                // Force the jumpserver now?
                if (data.force) {
                    // Get an interval between 5 and 6 minutes so everyone doesn't reconnect it all at once
                    var jump_server_interval = Math.random() * (360 - 300) + 300;

                    // Tell the user we are going to disconnect, wait 5 minutes then do the actual reconnect
                    var msg = _kiwi.global.i18n.translate('client_models_application_jumpserver_prepare').fetch();
                    that.message.text(msg, {timeout: 10000});

                    setTimeout(function forcedReconnect() {
                        var msg = _kiwi.global.i18n.translate('client_models_application_jumpserver_reconnect').fetch();
                        that.message.text(msg, {timeout: 8000});

                        setTimeout(function forcedReconnectPartTwo() {
                            _kiwi.app.kiwi_server = serv;

                            _kiwi.gateway.reconnect(function() {
                                // Reconnect all the IRC connections
                                that.connections.forEach(function(con){ con.reconnect(); });
                            });
                        }, 5000);

                    }, jump_server_interval * 1000);
                }
            });
        },



        /**
         * Bind to certain commands that may be typed into the control box
         */
        bindControllboxCommands: function (controlbox) {
            var that = this;

            // Default aliases
            $.extend(controlbox.preprocessor.aliases, {
                // General aliases
                '/p':    '/part $1+',
                '/me':   '/action $1+',
                '/j':    '/join $1+',
                '/q':    '/query $1+',
                '/w':    '/whois $1+',
                '/raw':  '/quote $1+',

                // Op related aliases
                '/op':       '/quote mode $channel +o $1+',
                '/deop':     '/quote mode $channel -o $1+',
                '/hop':      '/quote mode $channel +h $1+',
                '/dehop':    '/quote mode $channel -h $1+',
                '/voice':    '/quote mode $channel +v $1+',
                '/devoice':  '/quote mode $channel -v $1+',
                '/k':        '/kick $channel $1+',
                '/ban':      '/quote mode $channel +b $1+',
                '/unban':    '/quote mode $channel -b $1+',

                // Misc aliases
                '/slap':     '/me slaps $1 around a bit with a large trout'
            });

            // Functions to bind to controlbox events
            var fn_to_bind = {
                'unknown_command':     unknownCommand,
                'command':             allCommands,
                'command:msg':         msgCommand,
                'command:action':      actionCommand,
                'command:join':        joinCommand,
                'command:part':        partCommand,
                'command:nick':        nickCommand,
                'command:query':       queryCommand,
                'command:invite':      inviteCommand,
                'command:topic':       topicCommand,
                'command:notice':      noticeCommand,
                'command:quote':       quoteCommand,
                'command:kick':        kickCommand,
                'command:clear':       clearCommand,
                'command:ctcp':        ctcpCommand,
                'command:server':      serverCommand,
                'command:whois':       whoisCommand,
                'command:whowas':      whowasCommand,
                'command:encoding':    encodingCommand,
                'command:channel':     channelCommand,
                'command:applet':      appletCommand,
                'command:settings':    settingsCommand,
                'command:script':      scriptCommand
            };

            fn_to_bind['command:css'] = function (ev) {
                var queryString = '?reload=' + new Date().getTime();
                $('link[rel="stylesheet"]').each(function () {
                    this.href = this.href.replace(/\?.*|$/, queryString);
                });
            };

            fn_to_bind['command:js'] = function (ev) {
                if (!ev.params[0]) return;
                $script(ev.params[0] + '?' + (new Date().getTime()));
            };


            fn_to_bind['command:set'] = function (ev) {
                if (!ev.params[0]) return;

                var setting = ev.params[0],
                    value;

                // Do we have a second param to set a value?
                if (ev.params[1]) {
                    ev.params.shift();

                    value = ev.params.join(' ');

                    // If we're setting a true boolean value..
                    if (value === 'true')
                        value = true;

                    // If we're setting a false boolean value..
                    if (value === 'false')
                        value = false;

                    // If we're setting a number..
                    if (parseInt(value, 10).toString() === value)
                        value = parseInt(value, 10);

                    _kiwi.global.settings.set(setting, value);
                }

                // Read the value to the user
                _kiwi.app.panels().active.addMsg('', setting + ' = ' + _kiwi.global.settings.get(setting).toString());
            };


            fn_to_bind['command:save'] = function (ev) {
                _kiwi.global.settings.save();
                _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_settings_saved').fetch());
            };


            fn_to_bind['command:alias'] = function (ev) {
                var name, rule;

                // No parameters passed so list them
                if (!ev.params[1]) {
                    $.each(controlbox.preprocessor.aliases, function (name, rule) {
                        _kiwi.app.panels().server.addMsg(' ', name + '   =>   ' + rule);
                    });
                    return;
                }

                // Deleting an alias?
                if (ev.params[0] === 'del' || ev.params[0] === 'delete') {
                    name = ev.params[1];
                    if (name[0] !== '/') name = '/' + name;
                    delete controlbox.preprocessor.aliases[name];
                    return;
                }

                // Add the alias
                name = ev.params[0];
                ev.params.shift();
                rule = ev.params.join(' ');

                // Make sure the name starts with a slash
                if (name[0] !== '/') name = '/' + name;

                // Now actually add the alias
                controlbox.preprocessor.aliases[name] = rule;
            };


            fn_to_bind['command:ignore'] = function (ev) {
                var list = this.connections.active_connection.get('ignore_list');

                // No parameters passed so list them
                if (!ev.params[0]) {
                    if (list.length > 0) {
                        _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_title').fetch() + ':');
                        $.each(list, function (idx, ignored_pattern) {
                            _kiwi.app.panels().active.addMsg(' ', ignored_pattern);
                        });
                    } else {
                        _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_none').fetch());
                    }
                    return;
                }

                // We have a parameter, so add it
                list.push(ev.params[0]);
                this.connections.active_connection.set('ignore_list', list);
                _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_nick').fetch(ev.params[0]));
            };


            fn_to_bind['command:unignore'] = function (ev) {
                var list = this.connections.active_connection.get('ignore_list');

                if (!ev.params[0]) {
                    _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_stop_notice').fetch());
                    return;
                }

                list = _.reject(list, function(pattern) {
                    return pattern === ev.params[0];
                });

                this.connections.active_connection.set('ignore_list', list);

                _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_stopped').fetch(ev.params[0]));
            };


            _.each(fn_to_bind, function(fn, event_name) {
                controlbox.on(event_name, _.bind(fn, that));
            });
        },


        isChannelName: function (channel_name) {
            var channel_prefix = _kiwi.gateway.get('channel_prefix');

            if (!channel_name || !channel_name.length) return false;
            return (channel_prefix.indexOf(channel_name[0]) > -1);
        }
    });




    // A fallback action. Send a raw command to the server
    function unknownCommand (ev) {
        var raw_cmd = ev.command + ' ' + ev.params.join(' ');
        console.log('RAW: ' + raw_cmd);
        this.connections.active_connection.gateway.raw(raw_cmd);
    }

    function allCommands (ev) {}

    function joinCommand (ev) {
        var panels, channel_names;

        channel_names = ev.params.join(' ').split(',');
        panels = this.connections.active_connection.createAndJoinChannels(channel_names);

        // Show the last channel if we have one
        if (panels.length)
            panels[panels.length - 1].view.show();
    }

    function queryCommand (ev) {
        var destination, message, panel;

        destination = ev.params[0];
        ev.params.shift();

        message = ev.params.join(' ');

        // Check if we have the panel already. If not, create it
        panel = this.connections.active_connection.panels.getByName(destination);
        if (!panel) {
            panel = new _kiwi.model.Query({name: destination});
            this.connections.active_connection.panels.add(panel);
        }

        if (panel) panel.view.show();

        if (message) {
            this.connections.active_connection.gateway.msg(panel.get('name'), message);
            panel.addMsg(_kiwi.app.connections.active_connection.get('nick'), message);
        }

    }

    function msgCommand (ev) {
        var message,
            destination = ev.params[0],
            panel = this.connections.active_connection.panels.getByName(destination) || this.panels().server;

        ev.params.shift();
        message = formatToIrcMsg(ev.params.join(' '));

        panel.addMsg(_kiwi.app.connections.active_connection.get('nick'), message);
        this.connections.active_connection.gateway.msg(destination, message);
    }

    function actionCommand (ev) {
        if (_kiwi.app.panels().active.isServer()) {
            return;
        }

        var panel = _kiwi.app.panels().active;
        panel.addMsg('', '* ' + _kiwi.app.connections.active_connection.get('nick') + ' ' + ev.params.join(' '), 'action');
        this.connections.active_connection.gateway.action(panel.get('name'), ev.params.join(' '));
    }

    function partCommand (ev) {
        var that = this;

        if (ev.params.length === 0) {
            this.connections.active_connection.gateway.part(_kiwi.app.panels().active.get('name'));
        } else {
            _.each(ev.params, function (channel) {
                that.connections.active_connection.gateway.part(channel);
            });
        }
    }

    function nickCommand (ev) {
        this.connections.active_connection.gateway.changeNick(ev.params[0]);
    }

    function topicCommand (ev) {
        var channel_name;

        if (ev.params.length === 0) return;

        if (this.isChannelName(ev.params[0])) {
            channel_name = ev.params[0];
            ev.params.shift();
        } else {
            channel_name = _kiwi.app.panels().active.get('name');
        }
        this.connections.active_connection.gateway.topic(channel_name, ev.params.join(' '));
    }

    function noticeCommand (ev) {
        var destination;

        // Make sure we have a destination and some sort of message
        if (ev.params.length <= 1) return;

        destination = ev.params[0];
        ev.params.shift();

        this.connections.active_connection.gateway.notice(destination, ev.params.join(' '));
    }

    function quoteCommand (ev) {
        var raw = ev.params.join(' ');
        this.connections.active_connection.gateway.raw(raw);
    }

    function kickCommand (ev) {
        var nick, panel = _kiwi.app.panels().active;

        if (!panel.isChannel()) return;

        // Make sure we have a nick
        if (ev.params.length === 0) return;

        nick = ev.params[0];
        ev.params.shift();

        this.connections.active_connection.gateway.kick(panel.get('name'), nick, ev.params.join(' '));
    }

    function clearCommand (ev) {
        // Can't clear a server or applet panel
        if (_kiwi.app.panels().active.isServer() || _kiwi.app.panels().active.isApplet()) {
            return;
        }

        if (_kiwi.app.panels().active.clearMessages) {
            _kiwi.app.panels().active.clearMessages();
        }
    }

    function ctcpCommand(ev) {
        var target, type;

        // Make sure we have a target and a ctcp type (eg. version, time)
        if (ev.params.length < 2) return;

        target = ev.params[0];
        ev.params.shift();

        type = ev.params[0];
        ev.params.shift();

        this.connections.active_connection.gateway.ctcp(true, type, target, ev.params.join(' '));
    }

    function settingsCommand (ev) {
        var settings = _kiwi.model.Applet.loadOnce('kiwi_settings');
        settings.view.show();
    }

    function scriptCommand (ev) {
        var editor = _kiwi.model.Applet.loadOnce('kiwi_script_editor');
        editor.view.show();
    }

    function appletCommand (ev) {
        if (!ev.params[0]) return;

        var panel = new _kiwi.model.Applet();

        if (ev.params[1]) {
            // Url and name given
            panel.load(ev.params[0], ev.params[1]);
        } else {
            // Load a pre-loaded applet
            if (_kiwi.applets[ev.params[0]]) {
                panel.load(new _kiwi.applets[ev.params[0]]());
            } else {
                _kiwi.app.panels().server.addMsg('', _kiwi.global.i18n.translate('client_models_application_applet_notfound').fetch(ev.params[0]));
                return;
            }
        }

        _kiwi.app.connections.active_connection.panels.add(panel);
        panel.view.show();
    }



    function inviteCommand (ev) {
        var nick, channel;

        // A nick must be specified
        if (!ev.params[0])
            return;

        // Can only invite into channels
        if (!_kiwi.app.panels().active.isChannel())
            return;

        nick = ev.params[0];
        channel = _kiwi.app.panels().active.get('name');

        _kiwi.app.connections.active_connection.gateway.raw('INVITE ' + nick + ' ' + channel);

        _kiwi.app.panels().active.addMsg('', '== ' + nick + ' has been invited to ' + channel, 'action');
    }


    function whoisCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (_kiwi.app.panels().active.isQuery()) {
            nick = _kiwi.app.panels().active.get('name');
        }

        if (nick)
            _kiwi.app.connections.active_connection.gateway.raw('WHOIS ' + nick + ' ' + nick);
    }


    function whowasCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (_kiwi.app.panels().active.isQuery()) {
            nick = _kiwi.app.panels().active.get('name');
        }

        if (nick)
            _kiwi.app.connections.active_connection.gateway.raw('WHOWAS ' + nick);
    }

    function encodingCommand (ev) {
        if (ev.params[0]) {
            _kiwi.gateway.setEncoding(null, ev.params[0], function (success) {
                if (success) {
                    _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_encoding_changed').fetch(ev.params[0]));
                } else {
                    _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_encoding_invalid').fetch(ev.params[0]));
                }
            });
        } else {
            _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_encoding_notspecified').fetch());
            _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_encoding_usage').fetch());
        }
    }

    function channelCommand (ev) {
        var active_panel = _kiwi.app.panels().active;

        if (!active_panel.isChannel())
            return;

        new _kiwi.model.ChannelInfo({channel: _kiwi.app.panels().active});
    }

    function serverCommand (ev) {
        var server, port, ssl, password, nick,
            tmp;

        // If no server address given, show the new connection dialog
        if (!ev.params[0]) {
            tmp = new _kiwi.view.MenuBox(_kiwi.global.i18n.translate('client_models_application_connection_create').fetch());
            tmp.addItem('new_connection', new _kiwi.model.NewConnection().view.$el);
            tmp.show();

            // Center screen the dialog
            tmp.$el.offset({
                top: (this.view.$el.height() / 2) - (tmp.$el.height() / 2),
                left: (this.view.$el.width() / 2) - (tmp.$el.width() / 2)
            });

            return;
        }

        // Port given in 'host:port' format and no specific port given after a space
        if (ev.params[0].indexOf(':') > 0) {
            tmp = ev.params[0].split(':');
            server = tmp[0];
            port = tmp[1];

            password = ev.params[1] || undefined;

        } else {
            // Server + port given as 'host port'
            server = ev.params[0];
            port = ev.params[1] || 6667;

            password = ev.params[2] || undefined;
        }

        // + in the port means SSL
        if (port.toString()[0] === '+') {
            ssl = true;
            port = parseInt(port.substring(1), 10);
        } else {
            ssl = false;
        }

        // Default port if one wasn't found
        port = port || 6667;

        // Use the same nick as we currently have
        nick = _kiwi.app.connections.active_connection.get('nick');

        _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_connection_connecting').fetch(server, port.toString()));

        _kiwi.gateway.newConnection({
            nick: nick,
            host: server,
            port: port,
            ssl: ssl,
            password: password,
            age: age,
            gender: gender,
            location: location
        }, function(err, new_connection) {
            if (err)
                _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_connection_error').fetch(server, port.toString(), err.toString()));
        });
    }

})();

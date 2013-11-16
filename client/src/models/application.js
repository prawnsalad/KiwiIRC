_kiwi.model.Application = function () {
    // Set to a reference to this object within initialize()
    var that = null;


    var model = function () {
        /** _kiwi.view.Application */
        this.view = null;

        /** _kiwi.view.StatusMessage */
        this.message = null;

        /* Address for the kiwi server */
        this.kiwi_server = null;

        this.initialize = function (options) {
            that = this;

            if (options[0].container) {
                this.set('container', options[0].container);
            }

            // The base url to the kiwi server
            this.set('base_path', options[0].base_path ? options[0].base_path : '/kiwi');

            // Path for the settings.json file
            this.set('settings_path', options[0].settings_path ?
                    options[0].settings_path :
                    this.get('base_path') + '/assets/settings.json'
            );

            // Any options sent down from the server
            this.server_settings = options[0].server_settings || {};
            this.translations = options[0].translations || {};

            // Best guess at where the kiwi server is
            this.detectKiwiServer();

            // Set any default settings before anything else is applied
            if (this.server_settings && this.server_settings.client && this.server_settings.client.settings) {
                this.applyDefaultClientSettings(this.server_settings.client.settings);
            }
        };


        this.start = function () {
            // Set the gateway up
            _kiwi.gateway = new _kiwi.model.Gateway();
            this.bindGatewayCommands(_kiwi.gateway);

            this.initializeClient();
            this.initializeGlobals();

            this.view.barsHide(true);

            this.showIntialConenctionDialog();
        };


        this.detectKiwiServer = function () {
            // If running from file, default to localhost:7777 by default
            if (window.location.protocol === 'file:') {
                this.kiwi_server = 'http://localhost:7778';
            } else {
                // Assume the kiwi server is on the same server
                this.kiwi_server = window.location.protocol + '//' + window.location.host;
            }
        };


        this.showIntialConenctionDialog = function() {
            var connection_dialog = new _kiwi.model.NewConnection();
            this.populateDefaultServerSettings(connection_dialog);

            connection_dialog.view.$el.addClass('initial');
            this.view.$el.find('.panel_container:first').append(connection_dialog.view.$el);

            var $info = $($('#tmpl_new_connection_info').html().trim());

            if ($info.html()) {
                connection_dialog.view.infoBoxSet($info);
                connection_dialog.view.infoBoxShow();
            }

            // TODO: Shouldn't really be here but it's not working in the view.. :/
            // Hack for firefox browers: Focus is not given on this event loop iteration
            setTimeout(function(){
                connection_dialog.view.$el.find('.nick').select();
            }, 0);

            // Once connected, close this dialog and remove its own event
            var fn = function() {
                connection_dialog.view.$el.slideUp(function() {
                    connection_dialog.view.dispose();
                    connection_dialog = null;

                    _kiwi.gateway.off('onconnect', fn);
                });

            };
            _kiwi.gateway.on('onconnect', fn);
        };


        this.initializeClient = function () {
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

            this.message = new _kiwi.view.StatusMessage({el: this.view.$el.find('.status_message')[0]});

            this.resize_handle = new _kiwi.view.ResizeHandler({el: this.view.$el.find('.memberlists_resize_handle')[0]});

            // Rejigg the UI sizes
            this.view.doLayout();
        };


        this.initializeGlobals = function () {
            _kiwi.global.connections = this.connections;

            _kiwi.global.panels = this.panels;
            _kiwi.global.panels.applets = this.applet_panels;

            _kiwi.global.components.Applet = _kiwi.model.Applet;
            _kiwi.global.components.Panel =_kiwi.model.Panel;
        };


        this.applyDefaultClientSettings = function (settings) {
            _.each(settings, function (value, setting) {
                if (typeof _kiwi.global.settings.get(setting) === 'undefined') {
                    _kiwi.global.settings.set(setting, value);
                }
            });
        };


        this.populateDefaultServerSettings = function (new_connection_dialog) {
            var parts;
            var defaults = {
                nick: '',
                server: '',
                port: 6667,
                ssl: false,
                channel: '#chat',
                channel_key: ''
            };
            var uricheck;


            /**
             * Get any settings set by the server
             * These settings may be changed in the server selection dialog or via URL parameters
             */
            if (this.server_settings.client) {
                if (this.server_settings.client.nick)
                    defaults.nick = this.server_settings.client.nick;

                if (this.server_settings.client.server)
                    defaults.server = this.server_settings.client.server;

                if (this.server_settings.client.port)
                    defaults.port = this.server_settings.client.port;

                if (this.server_settings.client.ssl)
                    defaults.ssl = this.server_settings.client.ssl;

                if (this.server_settings.client.channel)
                    defaults.channel = this.server_settings.client.channel;

                if (this.server_settings.client.channel_key)
                    defaults.channel_key = this.server_settings.client.channel_key;
            }



            /**
             * Get any settings passed in the URL
             * These settings may be changed in the server selection dialog
             */

            // Any query parameters first
            if (getQueryVariable('nick'))
                defaults.nick = getQueryVariable('nick');

            if (window.location.hash)
                defaults.channel = window.location.hash;


            // Process the URL part by part, extracting as we go
            parts = window.location.pathname.toString().replace(this.get('base_path'), '').split('/');

            if (parts.length > 0) {
                parts.shift();

                if (parts.length > 0 && parts[0]) {
                    // Check to see if we're dealing with an irc: uri, or whether we need to extract the server/channel info from the HTTP URL path.
                    uricheck = parts[0].substr(0, 7).toLowerCase();
                    if ((uricheck === 'ircs%3a') || (uricheck.substr(0,6) === 'irc%3a')) {
                        parts[0] = decodeURIComponent(parts[0]);
                        // irc[s]://<host>[:<port>]/[<channel>[?<password>]]
                        uricheck = /^irc(s)?:(?:\/\/?)?([^:\/]+)(?::([0-9]+))?(?:(?:\/)([^\?]*)(?:(?:\?)(.*))?)?$/.exec(parts[0]);
                        /*
                            uricheck[1] = ssl (optional)
                            uricheck[2] = host
                            uricheck[3] = port (optional)
                            uricheck[4] = channel (optional)
                            uricheck[5] = channel key (optional, channel must also be set)
                        */
                        if (uricheck) {
                            if (typeof uricheck[1] !== 'undefined') {
                                defaults.ssl = true;
                                if (defaults.port === 6667) {
                                    defaults.port = 6697;
                                }
                            }
                            defaults.server = uricheck[2];
                            if (typeof uricheck[3] !== 'undefined') {
                                defaults.port = uricheck[3];
                            }
                            if (typeof uricheck[4] !== 'undefined') {
                                defaults.channel = '#' + uricheck[4];
                                if (typeof uricheck[5] !== 'undefined') {
                                    defaults.channel_key = uricheck[5];
                                }
                            }
                        }
                        parts = [];
                    } else {
                        // Extract the port+ssl if we find one
                        if (parts[0].search(/:/) > 0) {
                            defaults.port = parts[0].substring(parts[0].search(/:/) + 1);
                            defaults.server = parts[0].substring(0, parts[0].search(/:/));
                            if (defaults.port[0] === '+') {
                                defaults.port = parseInt(defaults.port.substring(1), 10);
                                defaults.ssl = true;
                            } else {
                                defaults.ssl = false;
                            }

                        } else {
                            defaults.server = parts[0];
                        }

                        parts.shift();
                    }
                }

                if (parts.length > 0 && parts[0]) {
                    defaults.channel = '#' + parts[0];
                    parts.shift();
                }
            }

            // If any settings have been given by the server.. override any auto detected settings
            /**
             * Get any server restrictions as set in the server config
             * These settings can not be changed in the server selection dialog
             */
            if (this.server_settings && this.server_settings.connection) {
                if (this.server_settings.connection.server) {
                    defaults.server = this.server_settings.connection.server;
                }

                if (this.server_settings.connection.port) {
                    defaults.port = this.server_settings.connection.port;
                }

                if (this.server_settings.connection.ssl) {
                    defaults.ssl = this.server_settings.connection.ssl;
                }

                if (this.server_settings.connection.channel) {
                    defaults.channel = this.server_settings.connection.channel;
                }

                if (this.server_settings.connection.channel_key) {
                    defaults.channel_key = this.server_settings.connection.channel_key;
                }

                if (this.server_settings.connection.nick) {
                    defaults.nick = this.server_settings.connection.nick;
                }
            }

            // Set any random numbers if needed
            defaults.nick = defaults.nick.replace('?', Math.floor(Math.random() * 100000).toString());

            if (getQueryVariable('encoding'))
                defaults.encoding = getQueryVariable('encoding');

            // Populate the server select box with defaults
            new_connection_dialog.view.populateFields(defaults);
        };


        this.resumeSession = function(username, password) {
            var that = this;

            _kiwi.gateway.set('kiwi_server', this.kiwi_server);
            _kiwi.gateway.resumeSession(username, password, function(err, data) {
                console.log('resumeSession()', err, data);
            });
        };


        this.saveSession = function(username, password) {
            _kiwi.gateway.saveSession(username, password, function(err, data) {
                console.log('saveSession()', err, data);
            });
        };


        this.panels = (function() {
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
                panels.active = this.connections.active_panel;
                panels.server = this.connections.active_connection ?
                    this.connections.active_connection.panels.server :
                    null;

                return panels;
            };

            _.extend(fn, Backbone.Events);

            return fn;
        })();


        this.bindGatewayCommands = function (gw) {
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

                _kiwi.app.kiwi_server = serv;

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
                            _kiwi.gateway.reconnect(function() {
                                // Reconnect all the IRC connections
                                that.connections.forEach(function(con){ con.reconnect(); });
                            });
                        }, 5000);

                    }, jump_server_interval * 1000);
                }
            });
        };



        /**
         * Bind to certain commands that may be typed into the control box
         */
        this.bindControllboxCommands = function (controlbox) {
            // Default aliases
            $.extend(controlbox.preprocessor.aliases, {
                // General aliases
                '/p': '/part $1+',
                '/me': '/action $1+',
                '/j': '/join $1+',
                '/q': '/query $1+',
                '/w': '/whois $1+',
                '/raw': '/quote $1+',

                // Op related aliases
                '/op': '/quote mode $channel +o $1+',
                '/deop': '/quote mode $channel -o $1+',
                '/hop': '/quote mode $channel +h $1+',
                '/dehop': '/quote mode $channel -h $1+',
                '/voice': '/quote mode $channel +v $1+',
                '/devoice': '/quote mode $channel -v $1+',
                '/k': '/kick $channel $1+',

                // Misc aliases
                '/slap': '/me slaps $1 around a bit with a large trout'
            });

            controlbox.on('unknown_command', unknownCommand);

            controlbox.on('command', allCommands);
            controlbox.on('command:msg', msgCommand);

            controlbox.on('command:action', actionCommand);

            controlbox.on('command:join', joinCommand);

            controlbox.on('command:part', partCommand);

            controlbox.on('command:nick', function (ev) {
                _kiwi.gateway.changeNick(null, ev.params[0]);
            });

            controlbox.on('command:query', queryCommand);

            controlbox.on('command:invite', inviteCommand);

            controlbox.on('command:topic', topicCommand);

            controlbox.on('command:notice', noticeCommand);

            controlbox.on('command:quote', quoteCommand);

            controlbox.on('command:kick', kickCommand);

            controlbox.on('command:clear', clearCommand);

            controlbox.on('command:ctcp', ctcpCommand);

            controlbox.on('command:server', serverCommand);

            controlbox.on('command:whois', whoisCommand);

            controlbox.on('command:whowas', whowasCommand);

            controlbox.on('command:encoding', encodingCommand);

            controlbox.on('command:css', function (ev) {
                var queryString = '?reload=' + new Date().getTime();
                $('link[rel="stylesheet"]').each(function () {
                    this.href = this.href.replace(/\?.*|$/, queryString);
                });
            });

            controlbox.on('command:js', function (ev) {
                if (!ev.params[0]) return;
                $script(ev.params[0] + '?' + (new Date().getTime()));
            });


            controlbox.on('command:set', function (ev) {
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
            });


            controlbox.on('command:save', function (ev) {
                _kiwi.global.settings.save();
                _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_settings_saved').fetch());
            });


            controlbox.on('command:alias', function (ev) {
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
            });


            controlbox.on('command:ignore', function (ev) {
                var list = _kiwi.gateway.get('ignore_list');

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
                _kiwi.gateway.set('ignore_list', list);
                _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_nick').fetch(ev.params[0]));
            });


            controlbox.on('command:unignore', function (ev) {
                var list = _kiwi.gateway.get('ignore_list');

                if (!ev.params[0]) {
                    _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_stop_notice').fetch());
                    return;
                }

                list = _.reject(list, function(pattern) {
                    return pattern === ev.params[0];
                });

                _kiwi.gateway.set('ignore_list', list);

                _kiwi.app.panels().active.addMsg(' ', _kiwi.global.i18n.translate('client_models_application_ignore_stopped').fetch(ev.params[0]));
            });


            controlbox.on('command:applet', appletCommand);
            controlbox.on('command:settings', settingsCommand);
            controlbox.on('command:script', scriptCommand);
        };

        // A fallback action. Send a raw command to the server
        function unknownCommand (ev) {
            var raw_cmd = ev.command + ' ' + ev.params.join(' ');
            console.log('RAW: ' + raw_cmd);
            _kiwi.gateway.raw(null, raw_cmd);
        }

        function allCommands (ev) {}

        function joinCommand (ev) {
            var panels, channel_names;

            channel_names = ev.params.join(' ').split(',');
            panels = that.connections.active_connection.createAndJoinChannels(channel_names);

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
            panel = that.connections.active_connection.panels.getByName(destination);
            if (!panel) {
                panel = new _kiwi.model.Query({name: destination});
                that.connections.active_connection.panels.add(panel);
            }

            if (panel) panel.view.show();

            if (message) {
                that.connections.active_connection.gateway.msg(panel.get('name'), message);
                panel.addMsg(_kiwi.app.connections.active_connection.get('nick'), message);
            }

        }

        function msgCommand (ev) {
            var message,
                destination = ev.params[0],
                panel = that.connections.active_connection.panels.getByName(destination) || that.panels().server;

            ev.params.shift();
            message = formatToIrcMsg(ev.params.join(' '));

            panel.addMsg(_kiwi.app.connections.active_connection.get('nick'), message);
            _kiwi.gateway.privmsg(null, destination, message);
        }

        function actionCommand (ev) {
            if (_kiwi.app.panels().active.isServer()) {
                return;
            }

            var panel = _kiwi.app.panels().active;
            panel.addMsg('', '* ' + _kiwi.app.connections.active_connection.get('nick') + ' ' + ev.params.join(' '), 'action');
            _kiwi.gateway.action(null, panel.get('name'), ev.params.join(' '));
        }

        function partCommand (ev) {
            if (ev.params.length === 0) {
                _kiwi.gateway.part(null, _kiwi.app.panels().active.get('name'));
            } else {
                _.each(ev.params, function (channel) {
                    _kiwi.gateway.part(null, channel);
                });
            }
        }

        function topicCommand (ev) {
            var channel_name;

            if (ev.params.length === 0) return;

            if (that.isChannelName(ev.params[0])) {
                channel_name = ev.params[0];
                ev.params.shift();
            } else {
                channel_name = _kiwi.app.panels().active.get('name');
            }

            _kiwi.gateway.topic(null, channel_name, ev.params.join(' '));
        }

        function noticeCommand (ev) {
            var destination;

            // Make sure we have a destination and some sort of message
            if (ev.params.length <= 1) return;

            destination = ev.params[0];
            ev.params.shift();

            _kiwi.gateway.notice(null, destination, ev.params.join(' '));
        }

        function quoteCommand (ev) {
            var raw = ev.params.join(' ');
            _kiwi.gateway.raw(null, raw);
        }

        function kickCommand (ev) {
            var nick, panel = _kiwi.app.panels().active;

            if (!panel.isChannel()) return;

            // Make sure we have a nick
            if (ev.params.length === 0) return;

            nick = ev.params[0];
            ev.params.shift();

            _kiwi.gateway.kick(null, panel.get('name'), nick, ev.params.join(' '));
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

            _kiwi.gateway.ctcp(null, true, type, target, ev.params.join(' '));
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
                    top: (that.view.$el.height() / 2) - (tmp.$el.height() / 2),
                    left: (that.view.$el.width() / 2) - (tmp.$el.width() / 2)
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
                password: password
            }, function(err, new_connection) {
                if (err)
                    _kiwi.app.panels().active.addMsg('', _kiwi.global.i18n.translate('client_models_application_connection_error').fetch(server, port.toString(), err.toString()));
            });
        }





        this.isChannelName = function (channel_name) {
            var channel_prefix = _kiwi.gateway.get('channel_prefix');

            if (!channel_name || !channel_name.length) return false;
            return (channel_prefix.indexOf(channel_name[0]) > -1);
        };


    };


    model = Backbone.Model.extend(new model());

    return new model(arguments);
};

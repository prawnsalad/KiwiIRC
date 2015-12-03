(function() {

    function ClientUiCommands(app, controlbox) {
        this.app = app;
        this.controlbox = controlbox;

        this.addDefaultAliases();
        this.bindCommand(buildCommandFunctions());
    }

    _kiwi.misc.ClientUiCommands = ClientUiCommands;


    // Add the default user command aliases
    ClientUiCommands.prototype.addDefaultAliases = function() {
        $.extend(this.controlbox.preprocessor.aliases, {
            // General aliases
            '/p':        '/part $1+',
            '/me':       '/action $1+',
            '/j':        '/join $1+',
            '/q':        '/query $1+',
            '/w':        '/whois $1+',
            '/raw':      '/quote $1+',
            '/connect':  '/server $1+',

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
            '/slap':     '/me slaps $1 around a bit with a large trout',
            '/tick':     '/msg $channel ✔'
        });
    };


    /**
     * Add a new command action
     * @var command Object {'command:the_command': fn}
     */
    ClientUiCommands.prototype.bindCommand = function(command) {
        var that = this,
            descriptions = {};

        _.each(command, function(fn, event_name) {
            var command_fn, matches;
            if (typeof fn === 'function') {
                command_fn = fn;

            } else {
                command_fn = fn.fn;
                matches = ['/' + event_name.split(':')[1]];
                if (fn.aliases) {
                    matches = matches.concat(_.map(fn.aliases, function(a) {
                        return '/' + a;
                    }));
                }
                descriptions['/' + event_name.split(':')[1]] = {
                    description: fn.description,
                    matches: matches
                };
            }

            that.controlbox.on(event_name, _.bind(command_fn, that));
        });

        this.controlbox.setAutoCompleteCommands(descriptions);
    };




    /**
     * Default functions to bind to controlbox events
     **/

    function buildCommandFunctions() {
        var fn_to_bind = {
            'unknown_command':     unknownCommand,
            'command':             allCommands,
            'command:msg':         {fn: msgCommand, description: translateText('command_description_msg')},
            'command:action':      {fn: actionCommand, description: translateText('command_description_action'), aliases: ['me']},
            'command:join':        {fn: joinCommand, description: translateText('command_description_join'), aliases: ['j']},
            'command:part':        {fn: partCommand, description: translateText('command_description_part'), aliases: ['p']},
            'command:cycle':       {fn: cycleCommand, description: translateText('command_description_cycle')},
            'command:nick':        {fn: nickCommand, description: translateText('command_description_nick')},
            'command:query':       {fn: queryCommand, description: translateText('command_description_query')},
            'command:invite':      {fn: inviteCommand, description: translateText('command_description_invite')},
            'command:topic':       {fn: topicCommand, description: translateText('command_description_topic')},
            'command:notice':      {fn: noticeCommand, description: translateText('command_description_notice')},
            'command:quote':       {fn: quoteCommand, description: translateText('command_description_quote'), aliases: ['raw']},
            'command:kick':        {fn: kickCommand, description: translateText('command_description_kick')},
            'command:names':       {fn: namesCommand, description: ''},
            'command:mode':        {fn: modeCommand, description: ''},
            'command:clear':       {fn: clearCommand, description: translateText('command_description_clear')},
            'command:ctcp':        {fn: ctcpCommand, description: translateText('command_description_ctcp')},
            'command:quit':        {fn: quitCommand, description: translateText('command_description_quit'), aliases: ['q']},
            'command:server':      {fn: serverCommand, description: translateText('command_description_server')},
            'command:whois':       {fn: whoisCommand, description: translateText('command_description_whois'), aliases: ['w']},
            'command:whowas':      {fn: whowasCommand, description: translateText('command_description_whowas')},
            'command:away':        {fn: awayCommand, description: translateText('command_description_away')},
            'command:encoding':    {fn: encodingCommand, description: translateText('command_description_encoding')},
            'command:channel':     {fn: channelCommand, description: ''},
            'command:applet':      {fn: appletCommand, description: ''},
            'command:settings':    {fn: settingsCommand, description: translateText('command_description_settings')},
            'command:script':      {fn: scriptCommand, description: translateText('command_description_script')}
        };


        fn_to_bind['command:css'] = {
            description: translateText('command_description_css'),
            fn: function(ev) {
                this.app.view.reloadStyles();
            }
        };


        fn_to_bind['command:js'] = {
            description: translateText('command_description_js'),
            fn: function(ev) {
                if (!ev.params[0]) return;
                $script(ev.params[0] + '?' + (new Date().getTime()));
            }
        };


        fn_to_bind['command:set'] = {
            description: translateText('command_description_set'),
            fn: function(ev) {
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
                this.app.panels().active.addMsg('', styleText('set_setting', {text: setting + ' = ' + _kiwi.global.settings.get(setting).toString()}));
            }
        };


        fn_to_bind['command:save'] = {
            description: translateText('command_description_save'),
            fn: function(ev) {
                _kiwi.global.settings.save();
                this.app.panels().active.addMsg('', styleText('settings_saved', {text: translateText('client_models_application_settings_saved')}));
            }
        };


        fn_to_bind['command:alias'] = {
            description: translateText('command_description_alias'),
            fn: function(ev) {
                var that = this,
                    name, rule;

                // No parameters passed so list them
                if (!ev.params[1]) {
                    $.each(this.controlbox.preprocessor.aliases, function (name, rule) {
                        that.app.panels().server.addMsg(' ', styleText('list_aliases', {text: name + '   =>   ' + rule}));
                    });
                    return;
                }

                // Deleting an alias?
                if (ev.params[0] === 'del' || ev.params[0] === 'delete') {
                    name = ev.params[1];
                    if (name[0] !== '/') name = '/' + name;
                    delete this.controlbox.preprocessor.aliases[name];
                    return;
                }

                // Add the alias
                name = ev.params[0];
                ev.params.shift();
                rule = ev.params.join(' ');

                // Make sure the name starts with a slash
                if (name[0] !== '/') name = '/' + name;

                // Now actually add the alias
                this.controlbox.preprocessor.aliases[name] = rule;
            }
        };


        fn_to_bind['command:ignore'] = {
            description: translateText('command_description_ignore'),
            fn: function(ev) {
                var that = this,
                    ignore_list = this.app.connections.active_connection.ignore_list,
                    user_mask;

                // No parameters passed so list them
                if (!ev.params[0]) {
                    if (ignore_list.length > 0) {
                        this.app.panels().active.addMsg(' ', styleText('ignore_title', {text: translateText('client_models_application_ignore_title')}));
                        ignore_list.forEach(function(ignored) {
                            that.app.panels().active.addMsg(' ', styleText('ignored_pattern', {text: ignored.get('mask')}));
                        });
                    } else {
                        this.app.panels().active.addMsg(' ', styleText('ignore_none', {text: translateText('client_models_application_ignore_none')}));
                    }
                    return;
                }

                // We have a parameter, so add it, first convert it to a full mask.
                user_mask = toUserMask(ev.params[0]);
                ignore_list.addMask(user_mask);

                this.app.panels().active.addMsg(' ', styleText('ignore_nick', {text: translateText('client_models_application_ignore_nick', [user_mask])}));
            }
        };


        fn_to_bind['command:unignore'] = {
            description: translateText('command_description_unignore'),
            fn: function(ev) {
                var ignore_list = this.app.connections.active_connection.ignore_list,
                    user_mask, matches;

                if (!ev.params[0]) {
                    this.app.panels().active.addMsg(' ', styleText('ignore_stop_notice', {text: translateText('client_models_application_ignore_stop_notice')}));
                    return;
                }

                user_mask = toUserMask(ev.params[0]);
                matches = ignore_list.where({mask: user_mask});
                if (matches) {
                    ignore_list.remove(matches);
                }

                this.app.panels().active.addMsg(' ', styleText('ignore_stopped', {text: translateText('client_models_application_ignore_stopped', [user_mask])}));
            }
        };


        return fn_to_bind;
    }




    // A fallback action. Send a raw command to the server
    function unknownCommand (ev) {
        var raw_cmd = ev.command + ' ' + ev.params.join(' ');
        this.app.connections.active_connection.gateway.raw(raw_cmd);
    }


    function allCommands (ev) {}


    function joinCommand (ev) {
        var panels, channel_names;

        channel_names = ev.params.join(' ').split(',');
        panels = this.app.connections.active_connection.createAndJoinChannels(channel_names);

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
        panel = this.app.connections.active_connection.panels.getByName(destination);
        if (!panel) {
            panel = new _kiwi.model.Query({name: destination, network: this.app.connections.active_connection});
            this.app.connections.active_connection.panels.add(panel);
        }

        if (panel) panel.view.show();

        if (message) {
            this.app.connections.active_connection.gateway.msg(panel.get('name'), message);
            panel.addMsg(this.app.connections.active_connection.get('nick'), styleText('privmsg', {text: message}), 'privmsg');
        }

    }


    function msgCommand (ev) {
        var message,
            destination = ev.params[0],
            panel = this.app.connections.active_connection.panels.getByName(destination) || this.app.panels().server;

        ev.params.shift();
        message = ev.params.join(' ');

        panel.addMsg(this.app.connections.active_connection.get('nick'), styleText('privmsg', {text: message}), 'privmsg');
        this.app.connections.active_connection.gateway.msg(destination, message);
    }


    function actionCommand (ev) {
        if (this.app.panels().active.isServer()) {
            return;
        }

        var panel = this.app.panels().active;
        panel.addMsg('', styleText('action', {nick: this.app.connections.active_connection.get('nick'), text: ev.params.join(' ')}), 'action');
        this.app.connections.active_connection.gateway.action(panel.get('name'), ev.params.join(' '));
    }


    function partCommand (ev) {
        var that = this,
            chans,
            msg;
        if (ev.params.length === 0) {
            this.app.connections.active_connection.gateway.part(this.app.panels().active.get('name'));
        } else {
            chans = ev.params[0].split(',');
            msg = ev.params.slice(1).join(' ');
            _.each(chans, function (channel) {
                that.app.connections.active_connection.gateway.part(channel, msg);
            });
        }
    }


    function cycleCommand (ev) {
        var that = this,
            chan_name;

        if (ev.params.length === 0) {
            chan_name = this.app.panels().active.get('name');
        } else {
            chan_name = ev.params[0];
        }

        this.app.connections.active_connection.gateway.part(chan_name);

        // Wait for a second to give the network time to register the part command
        setTimeout(function() {
            // Use createAndJoinChannels() here as it auto-creates panels instead of waiting for the network
            that.app.connections.active_connection.createAndJoinChannels(chan_name);
            that.app.connections.active_connection.panels.getByName(chan_name).show();
        }, 1000);
    }


    function nickCommand (ev) {
        this.app.connections.active_connection.gateway.changeNick(ev.params[0]);
    }


    function topicCommand (ev) {
        var channel_name;

        if (ev.params.length === 0) return;

        if (this.app.connections.active_connection.isChannelName(ev.params[0])) {
            channel_name = ev.params[0];
            ev.params.shift();
        } else {
            channel_name = this.app.panels().active.get('name');
        }

        this.app.connections.active_connection.gateway.topic(channel_name, ev.params.join(' '));
    }


    function noticeCommand (ev) {
        var destination;

        // Make sure we have a destination and some sort of message
        if (ev.params.length <= 1) return;

        destination = ev.params[0];
        ev.params.shift();

        this.app.connections.active_connection.gateway.notice(destination, ev.params.join(' '));
    }


    function quoteCommand (ev) {
        var raw = ev.params.join(' ');
        this.app.connections.active_connection.gateway.raw(raw);
    }


    function kickCommand (ev) {
        var nick, panel = this.app.panels().active;

        if (!panel.isChannel()) return;

        // Make sure we have a nick
        if (ev.params.length === 0) return;

        nick = ev.params[0];
        ev.params.shift();

        this.app.connections.active_connection.gateway.kick(panel.get('name'), nick, ev.params.join(' '));
    }


    function namesCommand (ev) {
        var channel, panel = this.app.panels().active;

        if (!panel.isChannel()) return;

        // Make sure we have a channel
        channel = ev.params.length === 0 ?
            panel.get('name') :
            ev.params[0];

        this.app.connections.active_connection.gateway.raw('NAMES ' + channel);
    }


    function modeCommand (ev) {
        var params, for_channel, network,
            panel = this.app.panels().active;

        network = panel.get('network');
        if (!network) {
            return;
        }

        // Use the specified channel is one is given..
        if (network.isChannelName(ev.params[0])) {
            for_channel = ev.params[0];
            params = ev.params.join(' ');

        // Use the current channel..
        } else if(panel.isChannel()) {
            for_channel = panel.get('name');
            params = for_channel;

        // Nothing to get a mode for..
        } else {
            return;
        }

        // Due to a flaw on the server-side we can't actually get modes for channels
        // that we are not joined. 
        network.gateway.on('channel_info', function onChanInfo(event) {
            if (event.channel.toLowerCase() !== for_channel.toLowerCase() || typeof event.modes === 'undefined') {
                return;
            }

            // No need to listen any more
            network.gateway.off('channel_info', onChanInfo);

            // Convert the modes into human readable format (+nt -xyz)
            var mode_string = _.chain(event.modes)
                .reduce(function(res, mode) {
                    var type = mode.mode[0]==='-'?'-':'+';
                    res[type].push(mode.mode.substr(1));
                    return res;
                }, {'+':[], '-':[]})
                .reduce(function(res, modes, type) {
                    if (modes.length > 0) res += type + modes.join('') + ' ';
                    return res;
                }, '')
                .value();
                
            panel.addMsg('', event.channel + ' ' + mode_string);
        });

        this.app.connections.active_connection.gateway.raw('MODE ' + params);
    }


    function clearCommand (ev) {
        // Can't clear a server or applet panel
        if (this.app.panels().active.isServer() || this.app.panels().active.isApplet()) {
            return;
        }

        if (this.app.panels().active.clearMessages) {
            this.app.panels().active.clearMessages();
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

        this.app.connections.active_connection.gateway.ctcpRequest(type, target, ev.params.join(' '));
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
            if (this.applets[ev.params[0]]) {
                panel.load(new this.applets[ev.params[0]]());
            } else {
                this.app.panels().server.addMsg('', styleText('applet_notfound', {text: translateText('client_models_application_applet_notfound', [ev.params[0]])}));
                return;
            }
        }

        this.app.connections.active_connection.panels.add(panel);
        panel.view.show();
    }


    function inviteCommand (ev) {
        var nick, channel;

        // A nick must be specified
        if (!ev.params[0])
            return;

        // Can only invite into channels
        if (!this.app.panels().active.isChannel())
            return;

        nick = ev.params[0];
        channel = this.app.panels().active.get('name');

        this.app.connections.active_connection.gateway.raw('INVITE ' + nick + ' ' + channel);

        this.app.panels().active.addMsg('', styleText('channel_has_been_invited', {nick: nick, text: translateText('client_models_application_has_been_invited', [channel])}), 'action');
    }


    function whoisCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (this.app.panels().active.isQuery()) {
            nick = this.app.panels().active.get('name');
        }

        if (nick)
            this.app.connections.active_connection.gateway.raw('WHOIS ' + nick + ' ' + nick);
    }


    function whowasCommand (ev) {
        var nick;

        if (ev.params[0]) {
            nick = ev.params[0];
        } else if (this.app.panels().active.isQuery()) {
            nick = this.app.panels().active.get('name');
        }

        if (nick)
            this.app.connections.active_connection.gateway.raw('WHOWAS ' + nick);
    }


    function awayCommand (ev) {
        this.app.connections.active_connection.gateway.raw('AWAY :' + ev.params.join(' '));
    }


    function encodingCommand (ev) {
        var that = this;

        if (ev.params[0]) {
            _kiwi.gateway.setEncoding(null, ev.params[0], function (success) {
                if (success) {
                    that.app.panels().active.addMsg('', styleText('encoding_changed', {text: translateText('client_models_application_encoding_changed', [ev.params[0]])}));
                } else {
                    that.app.panels().active.addMsg('', styleText('encoding_invalid', {text: translateText('client_models_application_encoding_invalid', [ev.params[0]])}));
                }
            });
        } else {
            this.app.panels().active.addMsg('', styleText('client_models_application_encoding_notspecified', {text: translateText('client_models_application_encoding_notspecified')}));
            this.app.panels().active.addMsg('', styleText('client_models_application_encoding_usage', {text: translateText('client_models_application_encoding_usage')}));
        }
    }


    function channelCommand (ev) {
        var active_panel = this.app.panels().active;

        if (!active_panel.isChannel())
            return;

        new _kiwi.model.ChannelInfo({channel: this.app.panels().active});
    }


    function quitCommand (ev) {
        var network = this.app.connections.active_connection;

        if (!network)
            return;

        network.gateway.quit(ev.params.join(' '));
    }


    function serverCommand (ev) {
        var that = this,
            server, port, ssl, password, nick,
            tmp;

        // If no server address given, show the new connection dialog
        if (!ev.params[0]) {
            tmp = new _kiwi.view.MenuBox(_kiwi.global.i18n.translate('client_models_application_connection_create').fetch());
            tmp.addItem('new_connection', new _kiwi.model.NewConnection().view.$el);
            tmp.show();

            // Center screen the dialog
            tmp.$el.offset({
                top: (this.app.view.$el.height() / 2) - (tmp.$el.height() / 2),
                left: (this.app.view.$el.width() / 2) - (tmp.$el.width() / 2)
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
        nick = this.app.connections.active_connection.get('nick');

        this.app.panels().active.addMsg('', styleText('server_connecting', {text: translateText('client_models_application_connection_connecting', [server, port.toString()])}));

        _kiwi.gateway.newConnection({
            nick: nick,
            host: server,
            port: port,
            ssl: ssl,
            password: password
        }, function(err, new_connection) {
            var translated_err;

            if (err) {
                translated_err = translateText('client_models_application_connection_error', [server, port.toString(), err.toString()]);
                that.app.panels().active.addMsg('', styleText('server_connecting_error', {text: translated_err}));
            }
        });
    }

})();

_kiwi.model.Application = function () {
    // Set to a reference to this object within initialize()
    var that = null;

    // The auto connect details entered into the server select box
    var auto_connect_details = {};


    var model = function () {
        /** Instance of _kiwi.model.PanelList */
        this.panels = null;

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

            // Any options sent down from the server
            this.server_settings = options[0].server_settings || {};

            // Best guess at where the kiwi server is
            this.detectKiwiServer();
        };

        this.start = function () {
            // Only debug if set in the querystring
            if (!getQueryVariable('debug')) {
                manageDebug(false);
            } else {
                //manageDebug(true);
            }
            
            // Set the gateway up
            _kiwi.gateway = new _kiwi.model.Gateway();
            this.bindGatewayCommands(_kiwi.gateway);

            this.initializeClient();
            this.initializeGlobals();

            this.view.barsHide(true);

            this.panels.server.server_login.bind('server_connect', function (event) {
                var server_login = this,
                    transport_path = '';
                auto_connect_details = event;

                server_login.networkConnecting();
                
                // Path to get the socket.io transport code
                transport_path = that.kiwi_server + that.get('base_path') + '/transport/socket.io.js?ts='+(new Date().getTime());
                
                $script(transport_path, function () {
                    if (!window.io) {
                        kiwiServerNotFound();
                        return;
                    }
                    _kiwi.gateway.set('kiwi_server', that.kiwi_server + '/kiwi');
                    _kiwi.gateway.set('nick', event.nick);
                    
                    _kiwi.gateway.connect(event.server, event.port, event.ssl, event.password, function (error) {
                        if (error) {
                            kiwiServerNotFound();
                        }
                    });
                });
            });

            // TODO: Shouldn't really be here but it's not working in the view.. :/
            // Hack for firefox browers: Focus is not given on this event loop iteration
            setTimeout(function(){
                _kiwi.app.panels.server.server_login.$el.find('.nick').select();
            }, 0);
        };


        function kiwiServerNotFound (e) {
            that.panels.server.server_login.showError();
        }


        this.detectKiwiServer = function () {
            // If running from file, default to localhost:7777 by default
            if (window.location.protocol === 'file:') {
                this.kiwi_server = 'http://localhost:7778';
            } else {
                // Assume the kiwi server is on the same server
                this.kiwi_server = window.location.protocol + '//' + window.location.host;
            }
        };


        this.initializeClient = function () {
            this.view = new _kiwi.view.Application({model: this, el: this.get('container')});
            
            /**
             * Set the UI components up
             */
            this.panels = new _kiwi.model.PanelList();

            this.controlbox = new _kiwi.view.ControlBox({el: $('#controlbox')[0]});
            this.bindControllboxCommands(this.controlbox);

            this.topicbar = new _kiwi.view.TopicBar({el: $('#topic')[0]});

            new _kiwi.view.AppToolbar({el: $('#toolbar .app_tools')[0]});

            this.message = new _kiwi.view.StatusMessage({el: $('#status_message')[0]});

            this.resize_handle = new _kiwi.view.ResizeHandler({el: $('#memberlists_resize_handle')[0]});
            
            this.panels.server.view.show();

            // Rejigg the UI sizes
            this.view.doLayout();

            this.populateDefaultServerSettings();
        };


        this.initializeGlobals = function () {
            _kiwi.global.control = this.controlbox;
            _kiwi.global.gateway = _kiwi.gateway;
            _kiwi.global.panels = this.panels;
            
            _kiwi.global.components = {
                Applet: _kiwi.model.Applet,
                Panel: _kiwi.model.Panel
            };
        };


        this.populateDefaultServerSettings = function () {
            var parts;
            var defaults = {
                nick: getQueryVariable('nick') || 'kiwi_?',
                server: 'irc.kiwiirc.com',
                port: 6667,
                ssl: false,
                channel: window.location.hash || '#kiwiirc',
                channel_key: ''
            };
            var uricheck;


            /**
             * Get any settings set by the server
             * These settings may be changed in the server selection dialog
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
            }



            /**
             * Get any settings passed in the URL
             * These settings may be changed in the server selection dialog
             */

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
             * These settings can not changed in the server selection dialog
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

                if (this.server_settings.connection.nick) {
                    defaults.nick = this.server_settings.connection.nick;
                }
            }

            // Set any random numbers if needed
            defaults.nick = defaults.nick.replace('?', Math.floor(Math.random() * 100000).toString());

            // Populate the server select box with defaults
            this.panels.server.server_login.populateFields(defaults);
        };


        this.bindGatewayCommands = function (gw) {
            gw.on('onmotd', function (event) {
                that.panels.server.addMsg(_kiwi.gateway.get('name'), event.msg, 'motd');
            });


            gw.on('onconnect', function (event) {
                that.view.barsShow();
                
                if (auto_connect_details.channel) {
                    that.controlbox.processInput('/JOIN ' + auto_connect_details.channel + ' ' + auto_connect_details.channel_key);
                }
            });


            (function () {
                var gw_stat = 0;

                gw.on('disconnect', function (event) {
                    var msg = 'You have been disconnected. Attempting to reconnect for you..';
                    that.message.text(msg, {timeout: 10000});

                    // Mention the disconnection on every channel
                    $.each(_kiwi.app.panels.models, function (idx, panel) {
                        if (!panel || !panel.isChannel()) return;
                        panel.addMsg('', msg, 'action quit');
                    });
                    _kiwi.app.panels.server.addMsg('', msg, 'action quit');

                    gw_stat = 1;
                });
                gw.on('reconnecting', function (event) {
                    msg = 'You have been disconnected. Attempting to reconnect again in ' + (event.delay/1000) + ' seconds..';
                    _kiwi.app.panels.server.addMsg('', msg, 'action quit');
                });
                gw.on('connect', function (event) {
                    if (gw_stat !== 1) return;

                    var msg = 'It\'s OK, you\'re connected again :)';
                    that.message.text(msg, {timeout: 5000});

                    // Mention the disconnection on every channel
                    $.each(_kiwi.app.panels.models, function (idx, panel) {
                        if (!panel || !panel.isChannel()) return;
                        panel.addMsg('', msg, 'action join');
                    });
                    _kiwi.app.panels.server.addMsg('', msg, 'action join');

                    gw_stat = 0;
                });
            })();


            gw.on('onjoin', function (event) {
                var c, members, user;
                c = that.panels.getByName(event.channel);
                if (!c) {
                    c = new _kiwi.model.Channel({name: event.channel});
                    that.panels.add(c);
                }

                members = c.get('members');
                if (!members) return;

                user = new _kiwi.model.Member({nick: event.nick, ident: event.ident, hostname: event.hostname});
                members.add(user);
                // TODO: highlight the new channel in some way
            });


            gw.on('onpart', function (event) {
                var channel, members, user,
                    part_options = {};

                part_options.type = 'part';
                part_options.message = event.message || '';

                channel = that.panels.getByName(event.channel);
                if (!channel) return;

                // If this is us, close the panel
                if (event.nick === _kiwi.gateway.get('nick')) {
                    channel.close();
                    return;
                }

                members = channel.get('members');
                if (!members) return;

                user = members.getByNick(event.nick);
                if (!user) return;

                members.remove(user, part_options);
            });


            gw.on('onquit', function (event) {
                var member, members,
                    quit_options = {};

                quit_options.type = 'quit';
                quit_options.message = event.message || '';

                $.each(that.panels.models, function (index, panel) {
                    if (!panel.isChannel()) return;

                    member = panel.get('members').getByNick(event.nick);
                    if (member) {
                        panel.get('members').remove(member, quit_options);
                    }
                });
            });


            gw.on('onkick', function (event) {
                var channel, members, user,
                    part_options = {};

                part_options.type = 'kick';
                part_options.by = event.nick;
                part_options.message = event.message || '';

                channel = that.panels.getByName(event.channel);
                if (!channel) return;

                members = channel.get('members');
                if (!members) return;

                user = members.getByNick(event.kicked);
                if (!user) return;

                members.remove(user, part_options);

                if (event.kicked === _kiwi.gateway.get('nick')) {
                    members.reset([]);
                }
                
            });


            gw.on('onmsg', function (event) {
                var panel,
                    is_pm = (event.channel == _kiwi.gateway.get('nick'));

                if (is_pm) {
                    // If a panel isn't found for this PM, create one
                    panel = that.panels.getByName(event.nick);
                    if (!panel) {
                        panel = new _kiwi.model.Query({name: event.nick});
                        that.panels.add(panel);
                    }

                } else {
                    // If a panel isn't found for this channel, reroute to the
                    // server panel
                    panel = that.panels.getByName(event.channel);
                    if (!panel) {
                        panel = that.panels.server;
                    }
                }
                
                panel.addMsg(event.nick, event.msg);
            });


            gw.on('onctcp_request', function (event) {
                // Reply to a TIME ctcp
                if (event.msg.toUpperCase() === 'TIME') {
                    gw.ctcp(true, event.type, event.nick, (new Date()).toString());
                }
            });


            gw.on('onnotice', function (event) {
                var panel;

                // Find a panel for the destination(channel) or who its from
                panel = that.panels.getByName(event.target) || that.panels.getByName(event.nick);
                if (!panel) {
                    panel = that.panels.server;
                }

                panel.addMsg('[' + (event.nick||'') + ']', event.msg);
            });


            gw.on('onaction', function (event) {
                var panel,
                    is_pm = (event.channel == _kiwi.gateway.get('nick'));

                if (is_pm) {
                    // If a panel isn't found for this PM, create one
                    panel = that.panels.getByName(event.nick);
                    if (!panel) {
                        panel = new _kiwi.model.Channel({name: event.nick});
                        that.panels.add(panel);
                    }

                } else {
                    // If a panel isn't found for this channel, reroute to the
                    // server panel
                    panel = that.panels.getByName(event.channel);
                    if (!panel) {
                        panel = that.panels.server;
                    }
                }

                panel.addMsg('', '* ' + event.nick + ' ' + event.msg, 'action');
            });


            gw.on('ontopic', function (event) {
                var c;
                c = that.panels.getByName(event.channel);
                if (!c) return;

                // Set the channels topic
                c.set('topic', event.topic);

                // If this is the active channel, update the topic bar too
                if (c.get('name') === _kiwi.app.panels.active.get('name')) {
                    that.topicbar.setCurrentTopic(event.topic);
                }
            });


            gw.on('ontopicsetby', function (event) {
                var c, when;
                c = that.panels.getByName(event.channel);
                if (!c) return;

                when = formatDate(new Date(event.when * 1000));
                c.addMsg('', 'Topic set by ' + event.nick + ' at ' + when, 'topic');
            });


            gw.on('onuserlist', function (event) {
                var channel;
                channel = that.panels.getByName(event.channel);

                // If we didn't find a channel for this, may aswell leave
                if (!channel) return;

                channel.temp_userlist = channel.temp_userlist || [];
                _.each(event.users, function (item) {
                    var user = new _kiwi.model.Member({nick: item.nick, modes: item.modes});
                    channel.temp_userlist.push(user);
                });
            });


            gw.on('onuserlist_end', function (event) {
                var channel;
                channel = that.panels.getByName(event.channel);

                // If we didn't find a channel for this, may aswell leave
                if (!channel) return;

                // Update the members list with the new list
                channel.get('members').reset(channel.temp_userlist || []);

                // Clear the temporary userlist
                delete channel.temp_userlist;
            });


            gw.on('onmode', function (event) {
                var channel, i, prefixes, members, member, find_prefix;
                
                // Build a nicely formatted string to be displayed to a regular human
                function friendlyModeString (event_modes, alt_target) {
                    var modes = {}, return_string;

                    // If no default given, use the main event info
                    if (!event_modes) {
                        event_modes = event.modes;
                        alt_target = event.target;
                    }

                    // Reformat the mode object to make it easier to work with
                    _.each(event_modes, function (mode){
                        var param = mode.param || alt_target || '';

                        // Make sure we have some modes for this param
                        if (!modes[param]) {
                            modes[param] = {'+':'', '-':''};
                        }

                        modes[param][mode.mode[0]] += mode.mode.substr(1);
                    });

                    // Put the string together from each mode
                    return_string = [];
                    _.each(modes, function (modeset, param) {
                        var str = '';
                        if (modeset['+']) str += '+' + modeset['+'];
                        if (modeset['-']) str += '-' + modeset['-'];
                        return_string.push(str + ' ' + param);
                    });
                    return_string = return_string.join(', ');

                    return return_string;
                }


                channel = that.panels.getByName(event.target);
                if (channel) {
                    prefixes = _kiwi.gateway.get('user_prefixes');
                    find_prefix = function (p) {
                        return event.modes[i].mode[1] === p.mode;
                    };
                    for (i = 0; i < event.modes.length; i++) {
                        if (_.any(prefixes, find_prefix)) {
                            if (!members) {
                                members = channel.get('members');
                            }
                            member = members.getByNick(event.modes[i].param);
                            if (!member) {
                                console.log('MODE command recieved for unknown member %s on channel %s', event.modes[i].param, event.target);
                                return;
                            } else {
                                if (event.modes[i].mode[0] === '+') {
                                    member.addMode(event.modes[i].mode[1]);
                                } else if (event.modes[i].mode[0] === '-') {
                                    member.removeMode(event.modes[i].mode[1]);
                                }
                                members.sort();
                                //channel.addMsg('', '== ' + event.nick + ' set mode ' + event.modes[i].mode + ' ' + event.modes[i].param, 'action mode');
                            }
                        } else {
                            // Channel mode being set
                            // TODO: Store this somewhere?
                            //channel.addMsg('', 'CHANNEL === ' + event.nick + ' set mode ' + event.modes[i].mode + ' on ' + event.target, 'action mode');
                        }
                    }

                    channel.addMsg('', '== ' + event.nick + ' sets mode ' + friendlyModeString(), 'action mode');
                } else {
                    // This is probably a mode being set on us.
                    if (event.target.toLowerCase() === _kiwi.gateway.get("nick").toLowerCase()) {
                        that.panels.server.addMsg('', '== ' + event.nick + ' set mode ' + friendlyModeString(), 'action mode');
                    } else {
                       console.log('MODE command recieved for unknown target %s: ', event.target, event);
                    }
                }
            });


            gw.on('onnick', function (event) {
                var member;

                $.each(that.panels.models, function (index, panel) {
                    if (!panel.isChannel()) return;

                    member = panel.get('members').getByNick(event.nick);
                    if (member) {
                        member.set('nick', event.newnick);
                        panel.addMsg('', '== ' + event.nick + ' is now known as ' + event.newnick, 'action nick');
                    }
                });
            });


            gw.on('onwhois', function (event) {
                /*globals secondsToTime */
                var logon_date, idle_time = '', panel;

                if (event.end) {
                    return;
                }

                if (typeof event.idle !== 'undefined') {
                    idle_time = secondsToTime(parseInt(event.idle, 10));
                    idle_time = idle_time.h.toString().lpad(2, "0") + ':' + idle_time.m.toString().lpad(2, "0") + ':' + idle_time.s.toString().lpad(2, "0");
                }

                panel = _kiwi.app.panels.active;
                if (event.ident) {
                    panel.addMsg(event.nick, 'is ' + event.nick + '!' + event.ident + '@' + event.host + ' * ' + event.msg, 'whois');
                } else if (event.chans) {
                    panel.addMsg(event.nick, 'on ' + event.chans, 'whois');
                } else if (event.irc_server) {
                    panel.addMsg(event.nick, 'using ' + event.server, 'whois');
                } else if (event.msg) {
                    panel.addMsg(event.nick, event.msg, 'whois');
                } else if (event.logon) {
                    logon_date = new Date();
                    logon_date.setTime(event.logon * 1000);
                    logon_date = formatDate(logon_date);

                    panel.addMsg(event.nick, 'idle for ' + idle_time + ', signed on ' + logon_date, 'whois');
                } else {
                    panel.addMsg(event.nick, 'idle for ' + idle_time, 'whois');
                }
            });

            gw.on('onaway', function (event) {
                $.each(that.panels.models, function (index, panel) {
                    if (!panel.isChannel()) return;

                    member = panel.get('members').getByNick(event.nick);
                    if (member) {
                        member.set('away', !(!event.trailing));
                    }
                });
            });


            gw.on('onlist_start', function (data) {
                if (_kiwi.app.channel_list) {
                    _kiwi.app.channel_list.close();
                    delete _kiwi.app.channel_list;
                }

                var panel = new _kiwi.model.Applet(),
                    applet = new _kiwi.applets.Chanlist();

                panel.load(applet);
                
                _kiwi.app.panels.add(panel);
                panel.view.show();
                
                _kiwi.app.channel_list = applet;
            });


            gw.on('onlist_channel', function (data) {
                // TODO: Put this listener within the applet itself
                _kiwi.app.channel_list.addChannel(data.chans);
            });


            gw.on('onlist_end', function (data) {
                // TODO: Put this listener within the applet itself
                delete _kiwi.app.channel_list;
            });


            gw.on('onirc_error', function (data) {
                var panel, tmp;

                if (data.channel !== undefined && !(panel = _kiwi.app.panels.getByName(data.channel))) {
                    panel = _kiwi.app.panels.server;
                }

                switch (data.error) {
                case 'banned_from_channel':
                    panel.addMsg(' ', '== You are banned from ' + data.channel + '. ' + data.reason, 'status');
                    _kiwi.app.message.text('You are banned from ' + data.channel + '. ' + data.reason);
                    break;
                case 'bad_channel_key':
                    panel.addMsg(' ', '== Bad channel key for ' + data.channel, 'status');
                    _kiwi.app.message.text('Bad channel key or password for ' + data.channel);
                    break;
                case 'invite_only_channel':
                    panel.addMsg(' ', '== ' + data.channel + ' is invite only.', 'status');
                    _kiwi.app.message.text(data.channel + ' is invite only');
                    break;
                case 'channel_is_full':
                    panel.addMsg(' ', '== ' + data.channel + ' is full.', 'status');
                    _kiwi.app.message.text(data.channel + ' is full');
                    break;
                case 'chanop_privs_needed':
                    panel.addMsg(' ', '== ' + data.reason, 'status');
                    _kiwi.app.message.text(data.reason + ' (' + data.channel + ')');
                    break;
                case 'no_such_nick':
                    tmp = _kiwi.app.panels.getByName(data.nick);
                    if (tmp) {
                        tmp.addMsg(' ', '== ' + data.nick + ': ' + data.reason, 'status');
                    } else {
                        _kiwi.app.panels.server.addMsg(' ', '== ' + data.nick + ': ' + data.reason, 'status');
                    }
                    break;
                case 'nickname_in_use':
                    _kiwi.app.panels.server.addMsg(' ', '== The nickname ' + data.nick + ' is already in use. Please select a new nickname', 'status');
                    if (_kiwi.app.panels.server !== _kiwi.app.panels.active) {
                        _kiwi.app.message.text('The nickname "' + data.nick + '" is already in use. Please select a new nickname');
                    }

                    // Only show the nickchange component if the controlbox is open
                    if (that.controlbox.$el.css('display') !== 'none') {
                        (new _kiwi.view.NickChangeBox()).render();
                    }

                    break;
                default:
                    // We don't know what data contains, so don't do anything with it.
                    //_kiwi.front.tabviews.server.addMsg(null, ' ', '== ' + data, 'status');
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
            controlbox.on('command_msg', msgCommand);

            controlbox.on('command_action', actionCommand);

            controlbox.on('command_join', joinCommand);

            controlbox.on('command_part', partCommand);

            controlbox.on('command_nick', function (ev) {
                _kiwi.gateway.changeNick(ev.params[0]);
            });

            controlbox.on('command_query', queryCommand);

            controlbox.on('command_topic', topicCommand);

            controlbox.on('command_notice', noticeCommand);

            controlbox.on('command_quote', quoteCommand);

            controlbox.on('command_kick', kickCommand);


            controlbox.on('command_css', function (ev) {
                var queryString = '?reload=' + new Date().getTime();
                $('link[rel="stylesheet"]').each(function () {
                    this.href = this.href.replace(/\?.*|$/, queryString);
                });
            });

            controlbox.on('command_js', function (ev) {
                if (!ev.params[0]) return;
                $script(ev.params[0] + '?' + (new Date().getTime()));
            });

            
            controlbox.on('command_set', function (ev) {
                if (!ev.params[0]) return;

                var setting = ev.params[0],
                    value;

                // Do we have a second param to set a value?
                if (ev.params[1]) {
                    ev.params.shift();

                    value = ev.params.join(' ');
                    _kiwi.global.settings.set(setting, value);
                }

                // Read the value to the user
                _kiwi.app.panels.active.addMsg('', setting + ' = ' + _kiwi.global.settings.get(setting));
            });


            controlbox.on('command_save', function (ev) {
                _kiwi.global.settings.save();
                _kiwi.app.panels.active.addMsg('', 'Settings have been saved');
            });


            controlbox.on('command_alias', function (ev) {
                var name, rule;

                // No parameters passed so list them
                if (!ev.params[1]) {
                    $.each(controlbox.preprocessor.aliases, function (name, rule) {
                        _kiwi.app.panels.server.addMsg(' ', name + '   =>   ' + rule);
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

            controlbox.on('command_applet', appletCommand);
            controlbox.on('command_settings', settingsCommand);
        };

        // A fallback action. Send a raw command to the server
        function unknownCommand (ev) {
            var raw_cmd = ev.command + ' ' + ev.params.join(' ');
            console.log('RAW: ' + raw_cmd);
            _kiwi.gateway.raw(raw_cmd);
        }

        function allCommands (ev) {}

        function joinCommand (ev) {
            var channel, channel_names;

            channel_names = ev.params.join(' ').split(',');

            $.each(channel_names, function (index, channel_name) {
                // Trim any whitespace off the name
                channel_name = channel_name.trim();

                // Check if we have the panel already. If not, create it
                channel = that.panels.getByName(channel_name);
                if (!channel) {
                    channel = new _kiwi.model.Channel({name: channel_name});
                    _kiwi.app.panels.add(channel);
                }

                _kiwi.gateway.join(channel_name);
            });

            if (channel) channel.view.show();
            
        }

        function queryCommand (ev) {
            var destination, panel;

            destination = ev.params[0];

            // Check if we have the panel already. If not, create it
            panel = that.panels.getByName(destination);
            if (!panel) {
                panel = new _kiwi.model.Query({name: destination});
                _kiwi.app.panels.add(panel);
            }

            if (panel) panel.view.show();
            
        }

        function msgCommand (ev) {
            var destination = ev.params[0],
                panel = that.panels.getByName(destination) || that.panels.server;

            ev.params.shift();

            panel.addMsg(_kiwi.gateway.get('nick'), ev.params.join(' '));
            _kiwi.gateway.privmsg(destination, ev.params.join(' '));
        }

        function actionCommand (ev) {
            if (_kiwi.app.panels.active === _kiwi.app.panels.server) {
                return;
            }

            var panel = _kiwi.app.panels.active;
            panel.addMsg('', '* ' + _kiwi.gateway.get('nick') + ' ' + ev.params.join(' '), 'action');
            _kiwi.gateway.action(panel.get('name'), ev.params.join(' '));
        }

        function partCommand (ev) {
            if (ev.params.length === 0) {
                _kiwi.gateway.part(_kiwi.app.panels.active.get('name'));
            } else {
                _.each(ev.params, function (channel) {
                    _kiwi.gateway.part(channel);
                });
            }
            // TODO: More responsive = close tab now, more accurate = leave until part event
            //_kiwi.app.panels.remove(_kiwi.app.panels.active);
        }

        function topicCommand (ev) {
            var channel_name;

            if (ev.params.length === 0) return;

            if (that.isChannelName(ev.params[0])) {
                channel_name = ev.params[0];
                ev.params.shift();
            } else {
                channel_name = _kiwi.app.panels.active.get('name');
            }

            _kiwi.gateway.topic(channel_name, ev.params.join(' '));
        }

        function noticeCommand (ev) {
            var destination;

            // Make sure we have a destination and some sort of message
            if (ev.params.length <= 1) return;

            destination = ev.params[0];
            ev.params.shift();

            _kiwi.gateway.notice(destination, ev.params.join(' '));
        }

        function quoteCommand (ev) {
            var raw = ev.params.join(' ');
            _kiwi.gateway.raw(raw);
        }

        function kickCommand (ev) {
            var nick, panel = _kiwi.app.panels.active;

            if (!panel.isChannel()) return;

            // Make sure we have a nick
            if (ev.params.length === 0) return;

            nick = ev.params[0];
            ev.params.shift();

            _kiwi.gateway.kick(panel.get('name'), nick, ev.params.join(' '));
        }

        function settingsCommand (ev) {
            var settings = _kiwi.model.Applet.loadOnce('kiwi_settings');
            settings.view.show();
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
                    _kiwi.app.panels.server.addMsg('', 'Applet "' + ev.params[0] + '" does not exist');
                    return;
                }
            }
            
            _kiwi.app.panels.add(panel);
            panel.view.show();
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

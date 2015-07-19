(function () {

    _kiwi.model.Network = Backbone.Model.extend({
        defaults: {
            connection_id: 0,
            /**
            *   The name of the network
            *   @type    String
            */
            name: 'Network',

            /**
            *   The address (URL) of the network
            *   @type    String
            */
            address: '',

            /**
            *   The port for the network
            *   @type    Int
            */
            port: 6667,

            /**
            *   If this network uses SSL
            *   @type    Bool
            */
            ssl: false,

            /**
            *   The password to connect to this network
            *   @type    String
            */
            password: '',

            /**
            *   The current nickname
            *   @type   String
            */
            nick: '',

            /**
            *   The channel prefix for this network
            *   @type    String
            */
            channel_prefix: '#',

            /**
            *   The user prefixes for channel owner/admin/op/voice etc. on this network
            *   @type   Array
            */
            user_prefixes: [
                {symbol: '~', mode: 'q'},
                {symbol: '&', mode: 'a'},
                {symbol: '@', mode: 'o'},
                {symbol: '%', mode: 'h'},
                {symbol: '+', mode: 'v'}
            ],

            /**
            *   List of nicks we are ignoring
            *   @type Array
            */
            ignore_list: []
        },


        initialize: function () {
            // If we already have a connection, bind our events
            if (typeof this.get('connection_id') !== 'undefined') {
                this.gateway = _kiwi.global.components.Network(this.get('connection_id'));
                this.bindGatewayEvents();
            }

            // Create our panel list (tabs)
            this.panels = new _kiwi.model.PanelList([], this);
            //this.panels.network = this;

            // Automatically create a server tab
            var server_panel = new _kiwi.model.Server({name: 'Server', network: this});
            this.panels.add(server_panel);
            this.panels.server = this.panels.active = server_panel;
        },


        reconnect: function(callback_fn) {
            var that = this,
                server_info = {
                    nick:       this.get('nick'),
                    host:       this.get('address'),
                    port:       this.get('port'),
                    ssl:        this.get('ssl'),
                    password:   this.get('password')
                };

            _kiwi.gateway.makeIrcConnection(server_info, function(err, connection_id) {
                if (!err) {
                    that.gateway.dispose();

                    that.set('connection_id', connection_id);
                    that.gateway = _kiwi.global.components.Network(that.get('connection_id'));
                    that.bindGatewayEvents();

                    // Reset each of the panels connection ID
                    that.panels.forEach(function(panel) {
                        panel.set('connection_id', connection_id);
                    });

                    callback_fn && callback_fn(err);

                } else {
                    console.log("_kiwi.gateway.socket.on('error')", {reason: err});
                    callback_fn && callback_fn(err);
                }
            });
        },


        bindGatewayEvents: function () {
            //this.gateway.on('all', function() {console.log('ALL', this.get('connection_id'), arguments);});

            this.gateway.on('connect', onConnect, this);
            this.gateway.on('disconnect', onDisconnect, this);

            this.gateway.on('nick', function(event) {
                if (event.nick === this.get('nick')) {
                    this.set('nick', event.newnick);
                }
            }, this);

            this.gateway.on('options', onOptions, this);
            this.gateway.on('motd', onMotd, this);
            this.gateway.on('channel:join', onJoin, this);
            this.gateway.on('channel:part', onPart, this);
            this.gateway.on('channel:kick', onKick, this);
            this.gateway.on('quit', onQuit, this);
            this.gateway.on('message', onMessage, this);
            this.gateway.on('nick', onNick, this);
            this.gateway.on('ctcp_request', onCtcpRequest, this);
            this.gateway.on('ctcp_response', onCtcpResponse, this);
            this.gateway.on('topic', onTopic, this);
            this.gateway.on('topicsetby', onTopicSetBy, this);
            this.gateway.on('userlist', onUserlist, this);
            this.gateway.on('userlist_end', onUserlistEnd, this);
            this.gateway.on('banlist', onBanlist, this);
            this.gateway.on('mode', onMode, this);
            this.gateway.on('whois', onWhois, this);
            this.gateway.on('whowas', onWhowas, this);
            this.gateway.on('away', onAway, this);
            this.gateway.on('list_start', onListStart, this);
            this.gateway.on('irc_error', onIrcError, this);
            this.gateway.on('unknown_command', onUnknownCommand, this);
            this.gateway.on('channel_info', onChannelInfo, this);
            this.gateway.on('wallops', onWallops, this);
        },


        /**
         * Create panels and join the channel
         * This will not wait for the join event to create a panel. This
         * increases responsiveness in case of network lag
         */
        createAndJoinChannels: function (channels) {
            var that = this,
                panels = [];

            // Multiple channels may come as comma-delimited
            if (typeof channels === 'string') {
                channels = channels.split(',');
            }

            $.each(channels, function (index, channel_name_key) {
                // We may have a channel key so split it off
                var spli = channel_name_key.trim().split(' '),
                    channel_name = spli[0],
                    channel_key = spli[1] || '';

                // Trim any whitespace off the name
                channel_name = channel_name.trim();

                // Add channel_prefix in front of the first channel if missing
                if (that.get('channel_prefix').indexOf(channel_name[0]) === -1) {
                    // Could be many prefixes but '#' is highly likely the required one
                    channel_name = '#' + channel_name;
                }

                // Check if we have the panel already. If not, create it
                channel = that.panels.getByName(channel_name);
                if (!channel) {
                    channel = new _kiwi.model.Channel({name: channel_name, network: that});
                    that.panels.add(channel);
                }

                panels.push(channel);

                that.gateway.join(channel_name, channel_key);
            });


            return panels;
        },


        /**
         * Join all the open channels we have open
         * Reconnecting to a network would typically call this.
         */
        rejoinAllChannels: function() {
            var that = this;

            this.panels.forEach(function(panel) {
                if (!panel.isChannel())
                    return;

                that.gateway.join(panel.get('name'));
            });
        },

        isChannelName: function (channel_name) {
            var channel_prefix = this.get('channel_prefix');

            if (!channel_name || !channel_name.length) return false;
            return (channel_prefix.indexOf(channel_name[0]) > -1);
        },

        // Check if a user is ignored.
        // Accepts an object with nick, ident and hostname OR a string.
        isUserIgnored: function (mask) {
            var idx, list = this.get('ignore_list');

            if (typeof mask === "object") {
               mask = (mask.nick||'*')+'!'+(mask.ident||'*')+'@'+(mask.hostname||'*');
            } else if (typeof mask === "string") {
               mask = toUserMask(mask);
            }

            for (idx = 0; idx < list.length; idx++) {
                if (list[idx][1].test(mask)) {
                   return true;
                }
            }

            return false;
        },

        // Create a new query panel
        createQuery: function (nick) {
            var that = this,
                query;

            // Check if we have the panel already. If not, create it
            query = that.panels.getByName(nick);
            if (!query) {
                query = new _kiwi.model.Query({name: nick});
                that.panels.add(query);
            }

            // In all cases, show the demanded query
            query.view.show();

            return query;
        }
    });



    function onDisconnect(event) {
        this.set('connected', false);

        $.each(this.panels.models, function (index, panel) {
            if (!panel.isApplet()) {
                panel.addMsg('', styleText('network_disconnected', {text: translateText('client_models_network_disconnected', [])}), 'action quit');
            }
        });
    }



    function onConnect(event) {
        var panels, channel_names, ignore_list;

        // Update our nick with what the network gave us
        this.set('nick', event.nick);

        this.set('connected', true);

        // If this is a re-connection then we may have some channels to re-join
        this.rejoinAllChannels();

        // Auto joining channels
        if (this.auto_join && this.auto_join.channel) {
            panels = this.createAndJoinChannels(this.auto_join.channel + ' ' + (this.auto_join.key || ''));

            // Show the last channel if we have one
            if (panels)
                panels[panels.length - 1].view.show();

            delete this.auto_join;
        }

        // Load the ignore_list from previous visits
        ignore_list = new _kiwi.model.IgnoreList(this).list;
    }



    function onOptions(event) {
        var that = this;

        $.each(event.options, function (name, value) {
            switch (name) {
            case 'CHANTYPES':
                that.set('channel_prefix', value.join(''));
                break;
            case 'NETWORK':
                that.set('name', value);
                break;
            case 'PREFIX':
                that.set('user_prefixes', value);
                break;
            }
        });

        this.set('cap', event.cap);
    }



    function onMotd(event) {
        this.panels.server.addMsg(this.get('name'), styleText('motd', {text: event.msg}), 'motd');
    }



    function onJoin(event) {
        var c, members, user;
        c = this.panels.getByName(event.channel);
        if (!c) {
            c = new _kiwi.model.Channel({name: event.channel, network: this});
            this.panels.add(c);
        }

        members = c.get('members');
        if (!members) return;

        // Do we already have this member?
        if (members.getByNick(event.nick)) {
            return;
        }

        user = new _kiwi.model.Member({
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            user_prefixes: this.get('user_prefixes')
        });

        _kiwi.global.events.emit('channel:join', {channel: event.channel, user: user, network: this.gateway})
        .then(function() {
            members.add(user, {kiwi: event});
        });
    }



    function onPart(event) {
        var channel, members, user,
            part_options = {};

        part_options.type = 'part';
        part_options.message = event.message || '';
        part_options.time = event.time;

        channel = this.panels.getByName(event.channel);
        if (!channel) return;

        // If this is us, close the panel
        if (event.nick === this.get('nick')) {
            channel.close();
            return;
        }

        members = channel.get('members');
        if (!members) return;

        user = members.getByNick(event.nick);
        if (!user) return;

        _kiwi.global.events.emit('channel:leave', {channel: event.channel, user: user, type: 'part', message: part_options.message, network: this.gateway})
        .then(function() {
            members.remove(user, {kiwi: part_options});
        });
    }



    function onQuit(event) {
        var member, members,
            quit_options = {};

        quit_options.type = 'quit';
        quit_options.message = event.message || '';
        quit_options.time = event.time;

        $.each(this.panels.models, function (index, panel) {
            // Let any query panels know they quit
            if (panel.isQuery() && panel.get('name').toLowerCase() === event.nick.toLowerCase()) {
                panel.addMsg(' ', styleText('channel_quit', {
                    nick: event.nick,
                    text: translateText('client_models_channel_quit', [quit_options.message])
                }), 'action quit', {time: quit_options.time});
            }

            // Remove the nick from any channels
            if (panel.isChannel()) {
                member = panel.get('members').getByNick(event.nick);
                if (member) {
                    _kiwi.global.events.emit('channel:leave', {channel: panel.get('name'), user: member, type: 'quit', message: quit_options.message, network: this.gateway})
                    .then(function() {
                        panel.get('members').remove(member, {kiwi: quit_options});
                    });
                }
            }
        });
    }



    function onKick(event) {
        var channel, members, user,
            part_options = {};

        part_options.type = 'kick';
        part_options.by = event.nick;
        part_options.message = event.message || '';
        part_options.current_user_kicked = (event.kicked == this.get('nick'));
        part_options.current_user_initiated = (event.nick == this.get('nick'));
        part_options.time = event.time;

        channel = this.panels.getByName(event.channel);
        if (!channel) return;

        members = channel.get('members');
        if (!members) return;

        user = members.getByNick(event.kicked);
        if (!user) return;


        _kiwi.global.events.emit('channel:leave', {channel: event.channel, user: user, type: 'kick', message: part_options.message, network: this.gateway})
        .then(function() {
            members.remove(user, {kiwi: part_options});

            if (part_options.current_user_kicked) {
                members.reset([]);
            }
        });
    }



    function onMessage(event) {
        _kiwi.global.events.emit('message:new', {network: this.gateway, message: event})
        .then(_.bind(function() {
            var panel,
                is_pm = ((event.target || '').toLowerCase() == this.get('nick').toLowerCase());

            // An ignored user? don't do anything with it
            if (this.isUserIgnored(event)) {
                return;
            }

            if (event.type == 'notice') {
                if (event.from_server) {
                    panel = this.panels.server;

                } else {
                    panel = this.panels.getByName(event.target) || this.panels.getByName(event.nick);

                    // Forward ChanServ messages to its associated channel
                    if (event.nick && event.nick.toLowerCase() == 'chanserv' && event.msg.charAt(0) == '[') {
                        channel_name = /\[([^ \]]+)\]/gi.exec(event.msg);
                        if (channel_name && channel_name[1]) {
                            channel_name = channel_name[1];

                            panel = this.panels.getByName(channel_name);
                        }
                    }

                }

                if (!panel) {
                    panel = this.panels.server;
                }

            } else if (is_pm) {
                // If a panel isn't found for this PM and we allow new queries, create one
                panel = this.panels.getByName(event.nick);
                if (!panel && !_kiwi.global.settings.get('ignore_new_queries')) {
                    panel = new _kiwi.model.Query({name: event.nick, network: this});
                    this.panels.add(panel);
                } else if(!panel) {
                    // We have not allowed new queries and we have not opened the panel ourselves, don't process the message
                    return;
                }

            } else {
                // If a panel isn't found for this target, reroute to the
                // server panel
                panel = this.panels.getByName(event.target);
                if (!panel) {
                    panel = this.panels.server;
                }
            }

            switch (event.type){
            case 'message':
                panel.addMsg(event.nick, styleText('privmsg', {text: event.msg}), 'privmsg', {time: event.time});
                break;

            case 'action':
                panel.addMsg('', styleText('action', {nick: event.nick, text: event.msg}), 'action', {time: event.time});
                break;

            case 'notice':
                panel.addMsg('[' + (event.nick||'') + ']', styleText('notice', {text: event.msg}), 'notice', {time: event.time});

                // Show this notice to the active panel if it didn't have a set target, but only in an active channel or query window
                active_panel = _kiwi.app.panels().active;

                if (!event.from_server && panel === this.panels.server && active_panel !== this.panels.server) {
                    if (active_panel.get('network') === this && (active_panel.isChannel() || active_panel.isQuery()))
                        active_panel.addMsg('[' + (event.nick||'') + ']', styleText('notice', {text: event.msg}), 'notice', {time: event.time});
                }
                break;
            }
        }, this));
    }



    function onNick(event) {
        var member;

        $.each(this.panels.models, function (index, panel) {
            if (panel.get('name') == event.nick)
                panel.set('name', event.newnick);

            if (!panel.isChannel()) return;

            member = panel.get('members').getByNick(event.nick);
            if (member) {
                member.set('nick', event.newnick);
                panel.addMsg('', styleText('nick_changed', {nick: event.nick, text: translateText('client_models_network_nickname_changed', [event.newnick]), channel: name}), 'action nick', {time: event.time});
            }
        });
    }



    function onCtcpRequest(event) {
        // An ignored user? don't do anything with it
        if (this.isUserIgnored(event)) {
            return;
        }

        // Reply to a TIME ctcp
        if (event.msg.toUpperCase() === 'TIME') {
            this.gateway.ctcpResponse(event.type, event.nick, (new Date()).toString());
        } else if(event.type.toUpperCase() === 'PING') { // CTCP PING reply
            this.gateway.ctcpResponse(event.type, event.nick, event.msg.substr(5));
        }
    }



    function onCtcpResponse(event) {
        // An ignored user? don't do anything with it
        if (this.isUserIgnored(event)) {
            return;
        }

        this.panels.server.addMsg('[' + event.nick + ']',  styleText('ctcp', {text: event.msg}), 'ctcp', {time: event.time});
    }



    function onTopic(event) {
        var c;
        c = this.panels.getByName(event.channel);
        if (!c) return;

        // Set the channels topic
        c.set('topic', event.topic);

        // If this is the active channel, update the topic bar too
        if (c.get('name') === this.panels.active.get('name')) {
            _kiwi.app.topicbar.setCurrentTopic(event.topic);
        }
    }



    function onTopicSetBy(event) {
        var c, when;
        c = this.panels.getByName(event.channel);
        if (!c) return;

        when = new Date(event.when * 1000);
        c.set('topic_set_by', {nick: event.nick, when: when});
    }



    function onChannelInfo(event) {
        var channel = this.panels.getByName(event.channel);
        if (!channel) return;

        if (event.url) {
            channel.set('info_url', event.url);
        } else if (event.modes) {
            channel.set('info_modes', event.modes);
        }
    }



    function onUserlist(event) {
        var that = this,
            channel = this.panels.getByName(event.channel);

        // If we didn't find a channel for this, may aswell leave
        if (!channel) return;

        channel.temp_userlist = channel.temp_userlist || [];
        _.each(event.users, function (item) {
            var user = new _kiwi.model.Member({
                nick: item.nick,
                modes: item.modes,
                user_prefixes: that.get('user_prefixes')
            });
            channel.temp_userlist.push(user);
        });
    }



    function onUserlistEnd(event) {
        var channel;
        channel = this.panels.getByName(event.channel);

        // If we didn't find a channel for this, may aswell leave
        if (!channel) return;

        // Update the members list with the new list
        channel.get('members').reset(channel.temp_userlist || []);

        // Clear the temporary userlist
        delete channel.temp_userlist;
    }



    function onBanlist(event) {
        var channel = this.panels.getByName(event.channel);
        if (!channel)
            return;

        channel.set('banlist', event.bans || []);
    }



    function onMode(event) {
        var channel, i, prefixes, members, member, find_prefix,
            request_updated_banlist = false;

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


        channel = this.panels.getByName(event.target);
        if (channel) {
            prefixes = this.get('user_prefixes');
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
                    }
                } else {
                    // Channel mode being set
                    // TODO: Store this somewhere?
                    //channel.addMsg('', 'CHANNEL === ' + event.nick + ' set mode ' + event.modes[i].mode + ' on ' + event.target, 'action mode');
                }

                // TODO: Be smart, remove this specific ban from the banlist rather than request a whole banlist
                if (event.modes[i].mode[1] == 'b')
                    request_updated_banlist = true;
            }

            channel.addMsg('', styleText('mode', {nick: event.nick, text: translateText('client_models_network_mode', [friendlyModeString()]), channel: event.target}), 'action mode', {time: event.time});

            // TODO: Be smart, remove the specific ban from the banlist rather than request a whole banlist
            if (request_updated_banlist)
                this.gateway.raw('MODE ' + channel.get('name') + ' +b');

        } else {
            // This is probably a mode being set on us.
            if (event.target.toLowerCase() === this.get("nick").toLowerCase()) {
                this.panels.server.addMsg('', styleText('selfmode', {nick: event.nick, text: translateText('client_models_network_mode', [friendlyModeString()]), channel: event.target}), 'action mode');
            } else {
               console.log('MODE command recieved for unknown target %s: ', event.target, event);
            }
        }
    }



    function onWhois(event) {
        _kiwi.global.events.emit('whois', {nick: event.nick, network: this.gateway, whois: event})
        .then(function() {
            var logon_date, idle_time = '', panel;

            if (event.end)
                return;

            if (typeof event.idle !== 'undefined') {
                idle_time = secondsToTime(parseInt(event.idle, 10));
                idle_time = idle_time.h.toString().lpad(2, "0") + ':' + idle_time.m.toString().lpad(2, "0") + ':' + idle_time.s.toString().lpad(2, "0");
            }

            panel = _kiwi.app.panels().active;
            if (event.ident) {
                panel.addMsg(event.nick, styleText('whois_ident', {nick: event.nick, ident: event.ident, host: event.hostname, text: event.msg}), 'whois');

            } else if (event.chans) {
                panel.addMsg(event.nick, styleText('whois_channels', {nick: event.nick, text: translateText('client_models_network_channels', [event.chans])}), 'whois');
            } else if (event.irc_server) {
                panel.addMsg(event.nick, styleText('whois_server', {nick: event.nick, text: translateText('client_models_network_server', [event.irc_server, event.server_info])}), 'whois');
            } else if (event.msg) {
                panel.addMsg(event.nick, styleText('whois', {text: event.msg}), 'whois');
            } else if (event.logon) {
                logon_date = new Date();
                logon_date.setTime(event.logon * 1000);
                logon_date = _kiwi.utils.formatDate(logon_date);

                panel.addMsg(event.nick, styleText('whois_idle_and_signon', {nick: event.nick, text: translateText('client_models_network_idle_and_signon', [idle_time, logon_date])}), 'whois');
            } else if (event.away_reason) {
                panel.addMsg(event.nick, styleText('whois_away', {nick: event.nick, text: translateText('client_models_network_away', [event.away_reason])}), 'whois');
            } else {
                panel.addMsg(event.nick, styleText('whois_idle', {nick: event.nick, text: translateText('client_models_network_idle', [idle_time])}), 'whois');
            }
        });
    }

    function onWhowas(event) {
        var panel;

        if (event.end)
            return;

        panel = _kiwi.app.panels().active;
        if (event.hostname) {
            panel.addMsg(event.nick, styleText('who', {nick: event.nick, ident: event.ident, host: event.hostname, realname: event.real_name, text: event.msg}), 'whois');
        } else {
            panel.addMsg(event.nick, styleText('whois_notfound', {nick: event.nick, text: translateText('client_models_network_nickname_notfound', [])}), 'whois');
        }
    }


    function onAway(event) {
        $.each(this.panels.models, function (index, panel) {
            if (!panel.isChannel()) return;

            member = panel.get('members').getByNick(event.nick);
            if (member) {
                member.set('away', !(!event.reason));
            }
        });
    }



    function onListStart(event) {
        var chanlist = _kiwi.model.Applet.loadOnce('kiwi_chanlist');
        chanlist.view.show();
    }



    function onIrcError(event) {
        var panel, tmp;

        if (event.channel !== undefined && !(panel = this.panels.getByName(event.channel))) {
            panel = this.panels.server;
        }

        switch (event.error) {
        case 'banned_from_channel':
            panel.addMsg(' ', styleText('channel_banned', {nick: event.nick, text: translateText('client_models_network_banned', [event.channel, event.reason]), channel: event.channel}), 'status');
            _kiwi.app.message.text(_kiwi.global.i18n.translate('client_models_network_banned').fetch(event.channel, event.reason));
            break;
        case 'bad_channel_key':
            panel.addMsg(' ', styleText('channel_badkey', {nick: event.nick, text: translateText('client_models_network_channel_badkey', [event.channel]), channel: event.channel}), 'status');
            _kiwi.app.message.text(_kiwi.global.i18n.translate('client_models_network_channel_badkey').fetch(event.channel));
            break;
        case 'invite_only_channel':
            panel.addMsg(' ', styleText('channel_inviteonly', {nick: event.nick, text: translateText('client_models_network_channel_inviteonly', [event.nick, event.channel]), channel: event.channel}), 'status');
            _kiwi.app.message.text(event.channel + ' ' + _kiwi.global.i18n.translate('client_models_network_channel_inviteonly').fetch());
            break;
        case 'user_on_channel':
            panel.addMsg(' ', styleText('channel_alreadyin', {nick: event.nick, text: translateText('client_models_network_channel_alreadyin'), channel: event.channel}));
            break;
        case 'channel_is_full':
            panel.addMsg(' ', styleText('channel_limitreached', {nick: event.nick, text: translateText('client_models_network_channel_limitreached', [event.channel]), channel: event.channel}), 'status');
            _kiwi.app.message.text(event.channel + ' ' + _kiwi.global.i18n.translate('client_models_network_channel_limitreached').fetch(event.channel));
            break;
        case 'chanop_privs_needed':
            panel.addMsg(' ', styleText('chanop_privs_needed', {text: event.reason, channel: event.channel}), 'status');
            _kiwi.app.message.text(event.reason + ' (' + event.channel + ')');
            break;
        case 'cannot_send_to_channel':
            panel.addMsg(' ', '== ' + _kiwi.global.i18n.translate('Cannot send message to channel, you are not voiced').fetch(event.channel, event.reason), 'status');
            break;
        case 'no_such_nick':
            tmp = this.panels.getByName(event.nick);
            if (tmp) {
                tmp.addMsg(' ', styleText('no_such_nick', {nick: event.nick, text: event.reason, channel: event.channel}), 'status');
            } else {
                this.panels.server.addMsg(' ', styleText('no_such_nick', {nick: event.nick, text: event.reason, channel: event.channel}), 'status');
            }
            break;
        case 'nickname_in_use':
            this.panels.server.addMsg(' ', styleText('nickname_alreadyinuse', {nick: event.nick, text: translateText('client_models_network_nickname_alreadyinuse', [event.nick]), channel: event.channel}), 'status');
            if (this.panels.server !== this.panels.active) {
                _kiwi.app.message.text(_kiwi.global.i18n.translate('client_models_network_nickname_alreadyinuse').fetch(event.nick));
            }

            // Only show the nickchange component if the controlbox is open
            if (_kiwi.app.controlbox.$el.css('display') !== 'none') {
                (new _kiwi.view.NickChangeBox()).render();
            }

            break;

        case 'password_mismatch':
            this.panels.server.addMsg(' ', styleText('channel_badpassword', {nick: event.nick, text: translateText('client_models_network_badpassword', []), channel: event.channel}), 'status');
            break;

        case 'error':
            if (event.reason) {
                this.panels.server.addMsg(' ', styleText('general_error', {text: event.reason}), 'status');
            }
            break;

        default:
            // We don't know what data contains, so don't do anything with it.
            //_kiwi.front.tabviews.server.addMsg(null, ' ', '== ' + data, 'status');
        }
    }


    function onUnknownCommand(event) {
        var display_params = _.clone(event.params);

        // A lot of commands have our nick as the first parameter. This is redundant for us
        if (display_params[0] && display_params[0] == this.get('nick')) {
            display_params.shift();
        }

        this.panels.server.addMsg('', styleText('unknown_command', {text: '[' + event.command + '] ' + display_params.join(', ', '')}));
    }


    function onWallops(event) {
        var active_panel = _kiwi.app.panels().active;

        // Send to server panel
        this.panels.server.addMsg('[' + (event.nick||'') + ']', styleText('wallops', {text: event.msg}), 'wallops', {time: event.time});

        // Send to active panel if its a channel/query *and* it's related to this network
        if (active_panel !== this.panels.server && (active_panel.isChannel() || active_panel.isQuery()) && active_panel.get('network') === this)
            active_panel.addMsg('[' + (event.nick||'') + ']', styleText('wallops', {text: event.msg}), 'wallops', {time: event.time});
    }

}

)();

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
            user_prefixes: ['~', '&', '@', '+']
        },


        initialize: function () {
            this.gateway = _kiwi.global.components.Network(this.get('connection_id'));
            this.bindGatewayEvents();

            // Create our panel list (tabs)
            this.panels = new _kiwi.model.PanelList([], this);
            //this.panels.network = this;

            // Automatically create a server tab
            var server_panel = new _kiwi.model.Server({name: 'Server'});
            this.panels.add(server_panel);
            this.panels.server = this.panels.active = server_panel;
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
            this.gateway.on('join', onJoin, this);
            this.gateway.on('part', onPart, this);
            this.gateway.on('quit', onQuit, this);
            this.gateway.on('kick', onKick, this);
            this.gateway.on('msg', onMsg, this);
            this.gateway.on('nick', onNick, this);
            this.gateway.on('ctcp_request', onCtcpRequest, this);
            this.gateway.on('ctcp_response', onCtcpResponse, this);
            this.gateway.on('notice', onNotice, this);
            this.gateway.on('action', onAction, this);
            this.gateway.on('topic', onTopic, this);
            this.gateway.on('topicsetby', onTopicSetBy, this);
            this.gateway.on('userlist', onUserlist, this);
            this.gateway.on('userlist_end', onUserlistEnd, this);
            this.gateway.on('mode', onMode, this);
            this.gateway.on('whois', onWhois, this);
            this.gateway.on('whowas', onWhowas, this);
            this.gateway.on('away', onAway, this);
            this.gateway.on('list_start', onListStart, this);
            this.gateway.on('irc_error', onIrcError, this);
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

                // If not a valid channel name, display a warning
                if (!_kiwi.app.isChannelName(channel_name)) {
                    that.panels.server.addMsg('', channel_name + ' is not a valid channel name');
                    _kiwi.app.message.text(channel_name + ' is not a valid channel name', {timeout: 5000});
                    return;
                }

                // Check if we have the panel already. If not, create it
                channel = that.panels.getByName(channel_name);
                if (!channel) {
                    channel = new _kiwi.model.Channel({name: channel_name});
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
        }
    });


    
    function onDisconnect(event) {
        $.each(this.panels.models, function (index, panel) {
            panel.addMsg('', 'Disconnected from the IRC network', 'action quit');
        });
    }



    function onConnect(event) {
        var panels, channel_names;

        // Update our nick with what the network gave us
        this.set('nick', event.nick);

        // If this is a re-connection then we may have some channels to re-join
        this.rejoinAllChannels();

        // Auto joining channels
        if (this.auto_join && this.auto_join.channel) {
            panels = this.createAndJoinChannels(this.auto_join.channel + ' ' + (this.auto_join.channel_key || ''));

            // Show the last channel if we have one
            if (panels)
                panels[panels.length - 1].view.show();

            delete this.auto_join;
        }
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
        this.panels.server.addMsg(this.get('name'), event.msg, 'motd');
    }



    function onJoin(event) {
        var c, members, user;
        c = this.panels.getByName(event.channel);
        if (!c) {
            c = new _kiwi.model.Channel({name: event.channel});
            this.panels.add(c);
        }

        members = c.get('members');
        if (!members) return;

        user = new _kiwi.model.Member({nick: event.nick, ident: event.ident, hostname: event.hostname});
        members.add(user);
    }



    function onPart(event) {
        var channel, members, user,
            part_options = {};

        part_options.type = 'part';
        part_options.message = event.message || '';

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

        members.remove(user, part_options);
    }



    function onQuit(event) {
        var member, members,
            quit_options = {};

        quit_options.type = 'quit';
        quit_options.message = event.message || '';

        $.each(this.panels.models, function (index, panel) {
            if (!panel.isChannel()) return;

            member = panel.get('members').getByNick(event.nick);
            if (member) {
                panel.get('members').remove(member, quit_options);
            }
        });
    }



    function onKick(event) {
        var channel, members, user,
            part_options = {};

        part_options.type = 'kick';
        part_options.by = event.nick;
        part_options.message = event.message || '';
        part_options.current_user_kicked = (event.kicked == this.get('nick'))
        part_options.current_user_initiated = (event.nick == this.get('nick'))

        channel = this.panels.getByName(event.channel);
        if (!channel) return;

        members = channel.get('members');
        if (!members) return;

        user = members.getByNick(event.kicked);
        if (!user) return;


        members.remove(user, part_options);

        if (part_options.current_user_kicked) {
            members.reset([]);        
        }
    }



    function onMsg(event) {
        var panel,
            is_pm = (event.channel == this.get('nick'));

        // An ignored user? don't do anything with it
        if (_kiwi.gateway.isNickIgnored(event.nick)) {
            return;
        }

        if (is_pm) {
            // If a panel isn't found for this PM, create one
            panel = this.panels.getByName(event.nick);
            if (!panel) {
                panel = new _kiwi.model.Query({name: event.nick});
                this.panels.add(panel);
            }

        } else {
            // If a panel isn't found for this channel, reroute to the
            // server panel
            panel = this.panels.getByName(event.channel);
            if (!panel) {
                panel = this.panels.server;
            }
        }

        panel.addMsg(event.nick, event.msg);
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
                panel.addMsg('', '== ' + event.nick + ' is now known as ' + event.newnick, 'action nick');
            }
        });
    }



    function onCtcpRequest(event) {
        // An ignored user? don't do anything with it
        if (_kiwi.gateway.isNickIgnored(event.nick)) {
            return;
        }

        // Reply to a TIME ctcp
        if (event.msg.toUpperCase() === 'TIME') {
            this.gateway.ctcp(null, false, event.type, event.nick, (new Date()).toString());
        }
    }



    function onCtcpResponse(event) {
        // An ignored user? don't do anything with it
        if (_kiwi.gateway.isNickIgnored(event.nick)) {
            return;
        }

        this.panels.server.addMsg('[' + event.nick + ']', 'CTCP ' + event.msg);
    }



    function onNotice(event) {
        var panel, channel_name;

        // An ignored user? don't do anything with it
        if (!event.from_server && event.nick && _kiwi.gateway.isNickIgnored(event.nick)) {
            return;
        }

        // Find a panel for the destination(channel) or who its from
        if (!event.from_server) {
            panel = this.panels.getByName(event.target) || this.panels.getByName(event.nick);

            // Forward ChanServ messages to its associated channel
            if (event.nick.toLowerCase() == 'chanserv' && event.msg.charAt(0) == '[') {
                channel_name = /\[([^ \]]+)\]/gi.exec(event.msg);
                if (channel_name && channel_name[1]) {
                    channel_name = channel_name[1];

                    panel = this.panels.getByName(channel_name);
                }
            }

            if (!panel) {
                panel = this.panels.server;
            }
        } else {
            panel = this.panels.server;
        }

        panel.addMsg('[' + (event.nick||'') + ']', event.msg);

        // Show this notice to the active panel if it didn't have a set target
        if (!event.from_server && panel === this.panels.server)
            _kiwi.app.panels().active.addMsg('[' + (event.nick||'') + ']', event.msg);
    }



    function onAction(event) {
        var panel,
            is_pm = (event.channel == this.get('nick'));

        // An ignored user? don't do anything with it
        if (_kiwi.gateway.isNickIgnored(event.nick)) {
            return;
        }

        if (is_pm) {
            // If a panel isn't found for this PM, create one
            panel = this.panels.getByName(event.nick);
            if (!panel) {
                panel = new _kiwi.model.Channel({name: event.nick});
                this.panels.add(panel);
            }

        } else {
            // If a panel isn't found for this channel, reroute to the
            // server panel
            panel = this.panels.getByName(event.channel);
            if (!panel) {
                panel = this.panels.server;
            }
        }

        panel.addMsg('', '* ' + event.nick + ' ' + event.msg, 'action');
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

        when = formatDate(new Date(event.when * 1000));
        c.addMsg('', 'Topic set by ' + event.nick + ' at ' + when, 'topic');
    }



    function onUserlist(event) {
        var channel;
        channel = this.panels.getByName(event.channel);

        // If we didn't find a channel for this, may aswell leave
        if (!channel) return;

        channel.temp_userlist = channel.temp_userlist || [];
        _.each(event.users, function (item) {
            var user = new _kiwi.model.Member({nick: item.nick, modes: item.modes});
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



    function onMode(event) {
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
            if (event.target.toLowerCase() === this.get("nick").toLowerCase()) {
                this.panels.server.addMsg('', '== ' + event.nick + ' set mode ' + friendlyModeString(), 'action mode');
            } else {
               console.log('MODE command recieved for unknown target %s: ', event.target, event);
            }
        }
    }



    function onWhois(event) {
        var logon_date, idle_time = '', panel;

        if (event.end)
            return;

        if (typeof event.idle !== 'undefined') {
            idle_time = secondsToTime(parseInt(event.idle, 10));
            idle_time = idle_time.h.toString().lpad(2, "0") + ':' + idle_time.m.toString().lpad(2, "0") + ':' + idle_time.s.toString().lpad(2, "0");
        }

        panel = _kiwi.app.panels().active;
        if (event.ident) {
            panel.addMsg(event.nick, event.nick + ' [' + event.nick + '!' + event.ident + '@' + event.host + '] * ' + event.msg, 'whois');
        } else if (event.chans) {
            panel.addMsg(event.nick, 'Channels: ' + event.chans, 'whois');
        } else if (event.irc_server) {
            panel.addMsg(event.nick, 'Connected to server: ' + event.irc_server + ' ' + event.server_info, 'whois');
        } else if (event.msg) {
            panel.addMsg(event.nick, event.msg, 'whois');
        } else if (event.logon) {
            logon_date = new Date();
            logon_date.setTime(event.logon * 1000);
            logon_date = formatDate(logon_date);

            panel.addMsg(event.nick, 'idle for ' + idle_time + ', signed on ' + logon_date, 'whois');
        } else if (event.away_reason) {
            panel.addMsg(event.nick, 'Away: ' + event.away_reason, 'whois');
        } else {
            panel.addMsg(event.nick, 'idle for ' + idle_time, 'whois');
        }
    }

    function onWhowas(event) {
        var panel;

        if (event.end)
            return;

        panel = _kiwi.app.panels().active;
        if (event.host) {
            panel.addMsg(event.nick, event.nick + ' [' + event.nick + ((event.ident)? '!' + event.ident : '') + '@' + event.host + '] * ' + event.real_name, 'whois');
        } else {
            panel.addMsg(event.nick, 'No such nick', 'whois');
        }
    }


    function onAway(event) {
        $.each(this.panels.models, function (index, panel) {
            if (!panel.isChannel()) return;

            member = panel.get('members').getByNick(event.nick);
            if (member) {
                member.set('away', !(!event.trailing));
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
            panel.addMsg(' ', '== You are banned from ' + event.channel + '. ' + event.reason, 'status');
            _kiwi.app.message.text('You are banned from ' + event.channel + '. ' + event.reason);
            break;
        case 'bad_channel_key':
            panel.addMsg(' ', '== Bad channel key for ' + event.channel, 'status');
            _kiwi.app.message.text('Bad channel key or password for ' + event.channel);
            break;
        case 'invite_only_channel':
            panel.addMsg(' ', '== ' + event.channel + ' is invite only.', 'status');
            _kiwi.app.message.text(event.channel + ' is invite only');
            break;
        case 'channel_is_full':
            panel.addMsg(' ', '== ' + event.channel + ' is full.', 'status');
            _kiwi.app.message.text(event.channel + ' is full');
            break;
        case 'chanop_privs_needed':
            panel.addMsg(' ', '== ' + event.reason, 'status');
            _kiwi.app.message.text(event.reason + ' (' + event.channel + ')');
            break;
        case 'no_such_nick':
            tmp = this.panels.getByName(event.nick);
            if (tmp) {
                tmp.addMsg(' ', '== ' + event.nick + ': ' + event.reason, 'status');
            } else {
                this.panels.server.addMsg(' ', '== ' + event.nick + ': ' + event.reason, 'status');
            }
            break;
        case 'nickname_in_use':
            this.panels.server.addMsg(' ', '== The nickname ' + event.nick + ' is already in use. Please select a new nickname', 'status');
            if (this.panels.server !== this.panels.active) {
                _kiwi.app.message.text('The nickname "' + event.nick + '" is already in use. Please select a new nickname');
            }

            // Only show the nickchange component if the controlbox is open
            if (_kiwi.app.controlbox.$el.css('display') !== 'none') {
                (new _kiwi.view.NickChangeBox()).render();
            }

            break;

        case 'password_mismatch':
            this.panels.server.addMsg(' ', '== Incorrect password given', 'status');
            break;
        default:
            // We don't know what data contains, so don't do anything with it.
            //_kiwi.front.tabviews.server.addMsg(null, ' ', '== ' + data, 'status');
        }
    }
}

)();

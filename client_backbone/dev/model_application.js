kiwi.model.Application = Backbone.Model.extend(new (function () {
    var that = this;

    // The auto connect details entered into the server select box
    var auto_connect_details = {};

    /** Instance of kiwi.model.PanelList */
    this.panels = null;

    this.initialize = function () {
        // Update `that` with this new Model object
        that = this;
    };

    this.start = function () {
        // Only debug if set in the querystring
        if (!getQueryVariable('debug')) {
            manageDebug(false);
        } else {
            manageDebug(true);
        }
        
        // Set the gateway up
        kiwi.gateway = new kiwi.model.Gateway();
        this.bindGatewayCommands(kiwi.gateway);

        this.initializeClient();
        this.view.barsHide(true);

        this.panels.server.server_login.bind('server_connect', function (event) {
            auto_connect_details = event;

            kiwi.gateway.set('nick', event.nick);
            kiwi.gateway.connect(event.server, 6667, false, false, function () {});
        });

    };


    this.initializeClient = function () {
        this.view = new kiwi.view.Application({model: this, el: this.get('container')});

        
        /**
         * Set the UI components up
         */
        this.panels = new kiwi.model.PanelList();

        this.controlbox = new kiwi.view.ControlBox({el: $('#controlbox')[0]});
        this.bindControllboxCommands(this.controlbox);

        this.topicbar = new kiwi.view.TopicBar({el: $('#topic')[0]});

        
        this.panels.server.view.show();

        // Rejigg the UI sizes
        this.view.doLayout();

        // Populate the server select box with defaults
        this.panels.server.server_login.populateFields({
            'nick': getQueryVariable('nick') || 'kiwi_' + Math.ceil(Math.random() * 10000).toString(),
            'server': getQueryVariable('server') || 'irc.kiwiirc.com',
            'channel': window.location.hash || '#test'
        });
    };



    this.bindGatewayCommands = function (gw) {
        gw.on('onmotd', function (event) {
            that.panels.server.addMsg(event.server, event.msg, 'motd');
        });


        gw.on('onconnect', function (event) {
            that.view.barsShow();
            
            if (auto_connect_details.channel) {
                kiwi.gateway.join(auto_connect_details.channel);
            }
        });


        gw.on('onjoin', function (event) {
            var c, members, user;
            c = that.panels.getByName(event.channel);
            if (!c) {
                c = new kiwi.model.Channel({name: event.channel});
                that.panels.add(c);
            }

            members = c.get('members');
            if (!members) return;

            user = new kiwi.model.Member({nick: event.nick, ident: event.ident, hostname: event.hostname});
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
            if (event.nick === kiwi.gateway.get('nick')) {
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

            if (event.kicked === kiwi.gateway.get('nick')) {
                members.reset([]);
            }
            
        });


        gw.on('onmsg', function (event) {
            var panel,
                is_pm = (event.channel == kiwi.gateway.get('nick'));

            if (is_pm) {
                // If a panel isn't found for this PM, create one
                panel = that.panels.getByName(event.nick);
                if (!panel) {
                    panel = new kiwi.model.Channel({name: event.nick});
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
                is_pm = (event.channel == kiwi.gateway.get('nick'));

            if (is_pm) {
                // If a panel isn't found for this PM, create one
                panel = that.panels.getByName(event.nick);
                if (!panel) {
                    panel = new kiwi.model.Channel({name: event.nick});
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
            if (c.get('name') === kiwi.app.panels.active.get('name')) {
                that.topicbar.setCurrentTopic(event.topic);
            }
        });


        gw.on('ontopicsetby', function (event) {
            var c, when;
            c = that.panels.getByName(event.channel);
            if (!c) return;

            when = new Date(event.when * 1000).toLocaleString();
            c.addMsg('', 'Topic set by ' + event.nick + ' at ' + when, 'topic');
        });


        gw.on('onuserlist', function (event) {
            var channel;
            channel = that.panels.getByName(event.channel);

            // If we didn't find a channel for this, may aswell leave
            if (!channel) return;

            channel.temp_userlist = channel.temp_userlist || [];
            _.each(event.users, function (item) {
                var user = new kiwi.model.Member({nick: item.nick, modes: item.modes});
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
            var channel, members, member;

            if (!event.channel) return;
            channel = that.panels.getByName(event.channel);
            if (!channel) return;

            members = channel.get('members');
            if (!members) return;

            member = members.getByNick(event.effected_nick);
            if (!member) return;

            if (event.mode[0] === '+') {
                member.addMode(event.mode.substr(1));
            } else if (event.mode[0] === '-') {
                member.removeMode(event.mode.substr(1));
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
    };



    /**
     * Bind to certain commands that may be typed into the control box
     */
    this.bindControllboxCommands = function (controlbox) {
        controlbox.on('unknown_command', this.unknownCommand);

        controlbox.on('command', this.allCommands);
        controlbox.on('command_msg', this.msgCommand);

        controlbox.on('command_action', this.actionCommand);
        controlbox.on('command_me', this.actionCommand);

        controlbox.on('command_join', this.joinCommand);
        controlbox.on('command_j', this.joinCommand);

        controlbox.on('command_part', this.partCommand);
        controlbox.on('command_p', this.partCommand);

        controlbox.on('command_nick', function (ev) {
            kiwi.gateway.changeNick(ev.params[0]);
        });

        controlbox.on('command_query', this.queryCommand);
        controlbox.on('command_q', this.queryCommand);

        controlbox.on('command_topic', this.topicCommand);

        controlbox.on('command_notice', this.noticeCommand);

        controlbox.on('command_css', function (ev) {
            var queryString = '?reload=' + new Date().getTime();
            $('link[rel="stylesheet"]').each(function () {
                this.href = this.href.replace(/\?.*|$/, queryString);
            });
        });
    };

    // A fallback action. Send a raw command to the server
    this.unknownCommand = function (ev) {
        var raw_cmd = ev.command + ' ' + ev.params.join(' ');
        console.log('RAW: ' + raw_cmd);
        kiwi.gateway.raw(raw_cmd);
    };

    this.allCommands = function (ev) {
        console.log('allCommands', ev);
    };

    this.joinCommand = function (ev) {
        var channel, channel_names;

        channel_names = ev.params.join(' ').split(',');

        $.each(channel_names, function (index, channel_name) {
            // Trim any whitespace off the name
            channel_name = channel_name.trim();

            // Check if we have the panel already. If not, create it
            channel = that.panels.getByName(channel_name);
            if (!channel) {
                channel = new kiwi.model.Channel({name: channel_name});
                kiwi.app.panels.add(channel);
            }

            kiwi.gateway.join(channel_name);
        });

        if (channel) channel.view.show();
        
    };

    this.queryCommand = function (ev) {
        var destination, panel;

        destination = ev.params[0];

        // Check if we have the panel already. If not, create it
        panel = that.panels.getByName(destination);
        if (!panel) {
            panel = new kiwi.model.Channel({name: destination});
            kiwi.app.panels.add(panel);
        }

        if (panel) panel.view.show();
        
    };

    this.msgCommand = function (ev) {
        var destination = ev.params[0],
            panel = that.panels.getByName(destination) || that.panels.server;

        ev.params.shift();

        panel.addMsg(kiwi.gateway.get('nick'), ev.params.join(' '));
        kiwi.gateway.privmsg(destination, ev.params.join(' '));
    };

    this.actionCommand = function (ev) {
        if (kiwi.app.panels.active === kiwi.app.panels.server) {
            return;
        }

        var panel = kiwi.app.panels.active;
        panel.addMsg('', '* ' + kiwi.gateway.get('nick') + ' ' + ev.params.join(' '), 'action');
        kiwi.gateway.action(panel.get('name'), ev.params.join(' '));
    };

    this.partCommand = function (ev) {
        if (ev.params.length === 0) {
            kiwi.gateway.part(kiwi.app.panels.active.get('name'));
        } else {
            _.each(ev.params, function (channel) {
                kiwi.gateway.part(channel);
            });
        }
        // TODO: More responsive = close tab now, more accurate = leave until part event
        //kiwi.app.panels.remove(kiwi.app.panels.active);
    };

    this.topicCommand = function (ev) {
        var channel_name;

        if (ev.params.length === 0) return;

        if (that.isChannelName(ev.params[0])) {
            channel_name = ev.params[0];
            ev.params.shift();
        } else {
            channel_name = kiwi.app.panels.active.get('name');
        }

        kiwi.gateway.topic(channel_name, ev.params.join(' '));
    };

    this.noticeCommand = function (ev) {
        var destination;

        // Make sure we have a destination and some sort of message
        if (ev.params.length <= 1) return;

        destination = ev.params[0];
        ev.params.shift();

        kiwi.gateway.notice(destination, ev.params.join(' '));
    };





    this.isChannelName = function (channel_name) {
        var channel_prefix = kiwi.gateway.get('channel_prefix');

        if (!channel_name || !channel_name.length) return false;
        return (channel_prefix.indexOf(channel_name[0]) > -1);
    };

})());
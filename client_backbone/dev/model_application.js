kiwi.model.Application = Backbone.Model.extend(new (function () {
    var that = this;

    // The auto connect details entered into the server select box
    var auto_connect_details = {};

    /** Instance of kiwi.model.PanelList */
    this.panels = null;

    /** kiwi.view.Application */
    this.view;

    /** kiwi.view.StatusMessage */
    this.message;

    /* Address for the kiwi server */
    this.kiwi_server = null;

    this.initialize = function () {
        // Update `that` with this new Model object
        that = this;

        // Best guess at where the kiwi server is
        this.detectKiwiServer();
    };

    this.start = function () {
        // Only debug if set in the querystring
        if (!getQueryVariable('debug')) {
            //manageDebug(false);
        } else {
            //manageDebug(true);
        }
        
        // Set the gateway up
        kiwi.gateway = new kiwi.model.Gateway();
        this.bindGatewayCommands(kiwi.gateway);

        this.initializeClient();
        this.initializeGlobals();

        this.view.barsHide(true);

        this.panels.server.server_login.bind('server_connect', function (event) {
            var server_login = this;
            auto_connect_details = event;

            server_login.networkConnecting();
            
            $script(that.kiwi_server + '/socket.io/socket.io.js?ts='+(new Date().getTime()), function () {
                if (!window.io) {
                    kiwiServerNotFound();
                    return;
                }
                kiwi.gateway.set('kiwi_server', that.kiwi_server + '/kiwi');
                kiwi.gateway.set('nick', event.nick);
                
                kiwi.gateway.connect(event.server, event.port, event.ssl, event.password, function () {});
            });
        });

    };


    function kiwiServerNotFound (e) {
        that.panels.server.server_login.showError();
    }


    this.detectKiwiServer = function () {
        // If running from file, default to localhost:7777 by default
        if (window.location.protocol === 'file') {
            this.kiwi_server = 'http://localhost:7777';

        } else {
            // Assume the kiwi server is on the same server
            var proto = window.location.protocol === 'https' ?
                'https' :
                'http';

            this.kiwi_server = proto + '://' + window.location.host + ':' + (window.location.port || '80');
        }
        
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

        this.message = new kiwi.view.StatusMessage({el: $('#status_message')[0]});

        
        this.panels.server.view.show();

        // Rejigg the UI sizes
        this.view.doLayout();

        // Populate the server select box with defaults
        this.panels.server.server_login.populateFields({
            nick: getQueryVariable('nick') || 'kiwi_' + Math.ceil(Math.random() * 10000).toString(),
            server: getQueryVariable('server') || 'irc.kiwiirc.com',
            port: 6667,
            ssl: false,
            channel: window.location.hash || '#test'
        });
    };


    this.initializeGlobals = function () {
        kiwi.global.control = this.controlbox;
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


        (function () {
            var gw_stat = 0;

            gw.on('disconnect', function (event) {
                that.message.text('You have been disconnected. Attempting to reconnect..');
                gw_stat = 1;
            });
            gw.on('reconnecting', function (event) {
                that.message.text('You have been disconnected. Attempting to reconnect again in ' + (event.delay/1000) + ' seconds..');
            });
            gw.on('connect', function (event) {
                if (gw_stat !== 1) return;

                that.message.text('It\'s OK, you\'re connected again :)', {timeout: 5000});
                gw_stat = 0;
            });
        })();


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

            panel = kiwi.app.panels.active;
            if (event.msg) {
                panel.addMsg(event.nick, event.msg, 'whois');
            } else if (event.logon) {
                logon_date = new Date();
                logon_date.setTime(event.logon * 1000);
                logon_date = logon_date.toLocaleString();

                panel.addMsg(event.nick, 'idle for ' + idle_time + ', signed on ' + logon_date, 'whois');
            } else {
                panel.addMsg(event.nick, 'idle for ' + idle_time, 'whois');
            }
        });


        gw.on('onirc_error', function (data) {
            var panel, tmp;

            if (data.channel !== undefined && !(panel = kiwi.app.panels.getByName(data.channel))) {
                panel = kiwi.app.panels.server;
            }

            switch (data.error) {
            case 'banned_from_channel':
                panel.addMsg(' ', '=== You are banned from ' + data.channel + '. ' + data.reason, 'status');
                kiwi.app.message.text('You are banned from ' + data.channel + '. ' + data.reason);
                break;
            case 'bad_channel_key':
                panel.addMsg(' ', '=== Bad channel key for ' + data.channel, 'status');
                kiwi.app.message.text('Bad channel key or password for ' + data.channel);
                break;
            case 'invite_only_channel':
                panel.addMsg(' ', '=== ' + data.channel + ' is invite only.', 'status');
                kiwi.app.message.text(data.channel + ' is invite only');
                break;
            case 'channel_is_full':
                panel.addMsg(' ', '=== ' + data.channel + ' is full.', 'status');
                kiwi.app.message.text(data.channel + ' is full');
                break;
            case 'chanop_privs_needed':
                panel.addMsg(' ', '=== ' + data.reason, 'status');
                kiwi.app.message.text(data.reason + ' (' + data.channel + ')');
                break;
            case 'no_such_nick':
                tmp = kiwi.app.panels.getByName(data.nick);
                if (tmp) {
                    tmp.addMsg(' ', '=== ' + data.nick + ': ' + data.reason, 'status');
                } else {
                    kiwi.app.panels.server.addMsg(' ', '=== ' + data.nick + ': ' + data.reason, 'status');
                }
                break;
            case 'nickname_in_use':
                kiwi.app.panels.server.addMsg(' ', '=== The nickname ' + data.nick + ' is already in use. Please select a new nickname', 'status');
                if (kiwi.app.panels.server !== kiwi.app.panels.active) {
                    kiwi.app.message.text('The nickname "' + data.nick + '" is already in use. Please select a new nickname');
                }
                // TODO: Show a nick change box or something
                break;
            default:
                // We don't know what data contains, so don't do anything with it.
                //kiwi.front.tabviews.server.addMsg(null, ' ', '=== ' + data, 'status');
            }
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

        controlbox.on('command_quote', this.quoteCommand);


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

        controlbox.on('command_applet', this.appletCommand);
        controlbox.on('command_settings', this.settingsCommand);
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

    this.quoteCommand = function (ev) {
        var raw = ev.params.join(' ');
        kiwi.gateway.raw(raw);
    };

    this.settingsCommand = function (ev) {
        var panel = new kiwi.model.Applet();
        panel.load(new kiwi.applets.Settings());
        
        kiwi.app.panels.add(panel);
        panel.view.show();
    };

    this.appletCommand = function (ev) {
        if (!ev.params[0]) return;

        var panel = new kiwi.model.Applet();

        if (ev.params[1]) {
            // Url and name given
            panel.load(ev.params[0], ev.params[1]);
        } else {
            // Load a pre-loaded applet
            if (kiwi.applets[ev.params[0]]) {
                panel.load(new kiwi.applets[ev.params[0]]());
            } else {
                kiwi.app.panels.server.addMsg('', 'Applet "' + ev.params[0] + '" does not exist');
                return;
            }
        }
        
        kiwi.app.panels.add(panel);
        panel.view.show();
    };





    this.isChannelName = function (channel_name) {
        var channel_prefix = kiwi.gateway.get('channel_prefix');

        if (!channel_name || !channel_name.length) return false;
        return (channel_prefix.indexOf(channel_name[0]) > -1);
    };

})());
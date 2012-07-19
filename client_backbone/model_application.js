kiwi.model.Application = Backbone.Model.extend(new (function () {
    var that = this;

    this.initialize = function () {
        // Update `that` with this new Model object
        that = this;

        // Set the gateway up
        kiwi.gateway = new kiwi.model.Gateway();
        this.bindGatewayCommands(kiwi.gateway);

        //this.initializeLogin();
        this.initializeClient();

        kiwi.gateway.set('nick', 'kiwi_' + Math.ceil(Math.random() * 10000).toString());
        kiwi.gateway.connect('ate.anonnet.org', 6667, false, false, function () {
            console.log('gateway connected');
        });


    };

    this.initializeLogin = function () {
        // TODO: this
        // Show the server selection/login screen.
        // Once connected and logged in, then open the client screen (initializeClient)
    };


    this.initializeClient = function () {
        this.view = new kiwi.view.Application({model: this, el: this.get('container')})

        
        /**
         * Set the UI components up
         */
        this.controlbox = new kiwi.view.ControlBox({el: $('#controlbox')[0]});
        this.bindControllboxCommands(this.controlbox);

        // Container for the channels
        this.panels = new kiwi.model.PanelList();
        this.panels.server.view.show();

        // Rejigg the UI sizes
        this.view.doLayout();
    };



    this.bindGatewayCommands = function (gw) {
        gw.on('onmotd', function (event) {
            that.panels.server.addMsg(event.server, event.msg, 'motd');
        });


        gw.on('onconnect', function (event) {});


        gw.on('onjoin', function (event) {
            console.log(event);
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
            var channel, members, user;

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

            members.remove(user);
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
            kiwi.app.panels.server.addMsg('', event.msg, 'notice');
        });


        gw.on('ontopic', function (event) {
            var c;
            c = that.panels.getByName(event.channel);
            if (!c) return;

            // Set the channels topic
            c.set('topic', event.topic);

            // If this is the active channel, update the topic bar too
            if (c.get('name') === kiwi.current_panel.get('name')) {
                that.setCurrentTopic(event.topic);
            }
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
    };



    /**
     * Bind to certain commands that may be typed into the control box
     */
    this.bindControllboxCommands = function (controlbox) {
        controlbox.on('unknown_command', this.unknownCommand);

        controlbox.on('command', this.allCommands);
        controlbox.on('command_msg', this.msgCommand);

        controlbox.on('command_join', this.joinCommand);
        controlbox.on('command_j', this.joinCommand);

        controlbox.on('command_part', this.partCommand);
        controlbox.on('command_p', this.partCommand);

        controlbox.on('command_nick', function (ev) {
            kiwi.gateway.changeNick(ev.params[0]);
        });

        controlbox.on('command_css', function (ev) {
            var queryString = '?reload=' + new Date().getTime();
            $('link[rel="stylesheet"]').each(function () {
                this.href = this.href.replace(/\?.*|$/, queryString);
            });
        });
    };

    this.unknownCommand = function (ev) {
        kiwi.gateway.raw(ev.command + ' ' + ev.params.join(' '));
    };

    this.allCommands = function (ev) {
        console.log('allCommands', ev);
    };

    this.joinCommand = function (ev) {
        var c = new kiwi.model.Channel({name: ev.params[0]});
        kiwi.app.panels.add(c);
        c.view.show();
        kiwi.gateway.join(ev.params[0]);
    };

    this.msgCommand = function (ev) {
        kiwi.current_panel.addMsg(kiwi.gateway.get('nick'), ev.params.join(' '));
        kiwi.gateway.privmsg(kiwi.current_panel.get('name'), ev.params.join(' '));
    };

    this.partCommand = function (ev) {
        if (ev.params.length === 0) {
            kiwi.gateway.part(kiwi.current_panel.get('name'));
        } else {
            _.each(ev.params, function (channel) {
                kiwi.gateway.part(channel);
            });
        }
        //kiwi.app.panels.remove(kiwi.current_panel);
    };





    this.setCurrentTopic = function (new_topic) {
        $('#topic input').val(new_topic);
    };

})());
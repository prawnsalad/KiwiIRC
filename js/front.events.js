kiwi.front.events = {

	bindAll: function () {
        $(kiwi.gateway).bind("onmsg", this.onMsg);
        $(kiwi.gateway).bind("onnotice", this.onNotice);
        $(kiwi.gateway).bind("onaction", this.onAction);
        $(kiwi.gateway).bind("onmotd", this.onMOTD);
        $(kiwi.gateway).bind("onoptions", this.onOptions);
        $(kiwi.gateway).bind("onconnect", this.onConnect);
        $(kiwi.gateway).bind("onconnect_fail", this.onConnectFail);
        $(kiwi.gateway).bind("ondisconnect", this.onDisconnect);
        $(kiwi.gateway).bind("onreconnecting", this.onReconnecting);
        $(kiwi.gateway).bind("onnick", this.onNick);
        $(kiwi.gateway).bind("onuserlist", this.onUserList);
        $(kiwi.gateway).bind("onuserlist_end", this.onUserListEnd);
        $(kiwi.gateway).bind("onlist_start", this.onChannelListStart);
        $(kiwi.gateway).bind("onlist_channel", this.onChannelList);
        $(kiwi.gateway).bind("onlist_end", this.onChannelListEnd);
        $(kiwi.gateway).bind("banlist", this.onBanList);
        $(kiwi.gateway).bind("banlist_end", this.onBanListEnd);
        $(kiwi.gateway).bind("onjoin", this.onJoin);
        $(kiwi.gateway).bind("ontopic", this.onTopic);
        $(kiwi.gateway).bind("onpart", this.onPart);
        $(kiwi.gateway).bind("onkick", this.onKick);
        $(kiwi.gateway).bind("onquit", this.onQuit);
        $(kiwi.gateway).bind("onmode", this.onMode);
        $(kiwi.gateway).bind("onwhois", this.onWhois);
        $(kiwi.gateway).bind("onsync", this.onSync);
        $(kiwi.gateway).bind("onchannel_redirect", this.onChannelRedirect);
        $(kiwi.gateway).bind("ondebug", this.onDebug);
        $(kiwi.gateway).bind("onctcp_request", this.onCTCPRequest);
        $(kiwi.gateway).bind("onctcp_response", this.onCTCPResponse);
        $(kiwi.gateway).bind("onirc_error", this.onIRCError);
        $(kiwi.gateway).bind("onkiwi", this.onKiwi);
	},


    onMsg: function (e, data) {
        var destination, plugin_event, tab;
        // Is this message from a user?
        if (data.channel === kiwi.gateway.nick) {
            destination = data.nick.toLowerCase();
        } else {
            destination = data.channel.toLowerCase();
        }

        plugin_event = {nick: data.nick, msg: data.msg, destination: destination};
        plugin_event = kiwi.plugs.run('msg_recieved', plugin_event);
        if (!plugin_event) {
            return;
        }
        tab = Tabview.getTab(plugin_event.destination);
        if (!tab) {
            tab = new Tabview(plugin_event.destination);
        }
        tab.addMsg(null, plugin_event.nick, plugin_event.msg);
    },

    onDebug: function (e, data) {
        var tab = Tabview.getTab('kiwi_debug');
        if (!tab) {
            tab = new Tabview('kiwi_debug');
        }
        tab.addMsg(null, ' ', data.msg);
    },

    onAction: function (e, data) {
        var destination, tab;
        // Is this message from a user?
        if (data.channel === kiwi.gateway.nick) {
            destination = data.nick;
        } else {
            destination = data.channel;
        }

        tab = Tabview.getTab(destination);
        if (!tab) {
            tab = new Tabview(destination);
        }
        tab.addMsg(null, ' ', '* ' + data.nick + ' ' + data.msg, 'action', 'color:#555;');
    },

    onTopic: function (e, data) {
        var tab = Tabview.getTab(data.channel);
        if (tab) {
            tab.changeTopic(data.topic);
        }
    },

    onNotice: function (e, data) {
        var nick = (data.nick === undefined) ? '' : data.nick,
            enick = '[' + nick + ']',
            tab;

        if (Tabview.tabExists(data.target)) {
            Tabview.getTab(data.target).addMsg(null, enick, data.msg, 'notice');
        } else if (Tabview.tabExists(nick)) {
            Tabview.getTab(nick).addMsg(null, enick, data.msg, 'notice');
        } else {
            Tabview.getServerTab().addMsg(null, enick, data.msg, 'notice');
        }
    },

    onCTCPRequest: function (e, data) {
        var msg = data.msg.split(" ", 2);
        switch (msg[0]) {
        case 'PING':
            if (typeof msg[1] === 'undefined') {
                msg[1] = '';
            }
            kiwi.gateway.notice(data.nick, String.fromCharCode(1) + 'PING ' + msg[1] + String.fromCharCode(1));
            break;
        case 'TIME':
            kiwi.gateway.notice(data.nick, String.fromCharCode(1) + 'TIME ' + (new Date()).toLocaleString() + String.fromCharCode(1));
            break;
        }
        Tabview.getServerTab().addMsg(null, 'CTCP Request', '[from ' + data.nick + '] ' + data.msg, 'ctcp');
    },

    onCTCPResponse: function (e, data) {
        Tabview.getServerTab().addMsg(null, 'CTCP Reply', '[from ' + data.nick + '] ' + data.msg, 'ctcp');
    },

    onKiwi: function (e, data) {
        //console.log(data);
    },

    onConnect: function (e, data) {
        var err_box, channels;

        if (data.connected) {
            // Did we disconnect?
            err_box = $('.messages .msg.error.disconnect .text');
            if (typeof err_box[0] !== 'undefined') {
                err_box.text('Reconnected OK :)');
                err_box.parent().removeClass('disconnect');

                // Rejoin channels
                channels = '';
                _.each(Tabview.getAllTabs(), function (tabview) {
                    if (tabview.name === 'server') {
                        return;
                    }
                    channels += tabview.name + ',';
                });
                console.log('Rejoining: ' + channels);
                kiwi.gateway.join(channels);
                return;
            }

            if (kiwi.gateway.nick !== data.nick) {
                kiwi.gateway.nick = data.nick;
                kiwi.front.ui.doLayout();
            }

            Tabview.getServerTab().addMsg(null, ' ', '=== Connected OK :)', 'status');
            if (typeof init_data.channel === "string") {
                kiwi.front.joinChannel(init_data.channel);
            }
            kiwi.plugs.run('connect', {success: true});
        } else {
            Tabview.getServerTab().addMsg(null, ' ', '=== Failed to connect :(', 'status');
            kiwi.plugs.run('connect', {success: false});
        }
    },
    onConnectFail: function (e, data) {
        var reason = (typeof data.reason === 'string') ? data.reason : '';
        Tabview.getServerTab().addMsg(null, '', 'There\'s a problem connecting! (' + reason + ')', 'error');
        kiwi.plugs.run('connect', {success: false});
    },
    onDisconnect: function (e, data) {
        var tab, tabs;
        tabs = Tabview.getAllTabs();
        for (tab in tabs) {
            tabs[tab].addMsg(null, '', 'Disconnected from server!', 'error disconnect');
        }
        kiwi.plugs.run('disconnect', {success: false});
    },
    onReconnecting: function (e, data) {
        var err_box, f, msg, mins, secs;

        err_box = $('.messages .msg.error.disconnect .text');
        if (!err_box) {
            return;
        }

        f = function (num) {
            switch (num) {
            case 1: return 'First';
            case 2: return 'Second';
            case 3: return 'Third';
            case 4: return 'Fourth';
            case 5: return 'Fifth';
            case 6: return 'Sixth';
            case 7: return 'Seventh';
            default: return 'Next';
            }
        };

        secs = Math.floor(data.delay / 1000);
        mins = Math.floor(secs / 60);
        secs = secs % 60;
        if (mins > 0) {
            msg = f(data.attempts) + ' attempt at reconnecting in ' + mins + ' minute' + ((mins > 1) ? 's' : '') + ' , ' + secs + 'second' + (((secs > 1) || (secs === 0)) ? 's' : '') + '...';
        } else {
            msg = f(data.attempts) + ' attempt at reconnecting in ' + secs + ' second' + (((secs > 1) || (secs === 0)) ? 's' : '') + '...';
        }
        
        err_box.text(msg);
    },
    onOptions: function (e, data) {
        if (typeof kiwi.gateway.network_name === "string" && kiwi.gateway.network_name !== "") {
            Tabview.getServerTab().setTabText(kiwi.gateway.network_name);
        }
    },
    onMOTD: function (e, data) {
        Tabview.getServerTab().addMsg(null, data.server, data.msg, 'motd');
    },
    onWhois: function (e, data) {
        var d, tab, idle_time = '';

        if (data.end) return;

        if (typeof data.idle !== 'undefined'){
            idle_time = secondsToTime(parseInt(data.idle, 10));
            idle_time = idle_time.h.toString().lpad(2, "0") + ':' + idle_time.m.toString().lpad(2, "0") + ':' + idle_time.s.toString().lpad(2, "0");
        }

        tab = Tabview.getCurrentTab();
        if (data.msg) {
            tab.addMsg(null, data.nick, data.msg, 'whois');
        } else if (data.logon) {
            d = new Date();
            d.setTime(data.logon * 1000);
            d = d.toLocaleString();

            tab.addMsg(null, data.nick, 'idle for ' + idle_time + ', signed on ' + d, 'whois');
        } else {
            tab.addMsg(null, data.nick, 'idle for ' + idle_time, 'whois');
        }
    },
    onMode: function (e, data) {
        var tab;
        if ((typeof data.channel === 'string') && (typeof data.effected_nick === 'string')) {
            tab = Tabview.getTab(data.channel);
            tab.addMsg(null, ' ', '[' + data.mode + '] ' + data.effected_nick + ' by ' + data.nick, 'mode', '');
            if (tab.userlist.hasUser(data.effected_nick)) {
                tab.userlist.changeUserMode(data.effected_nick, data.mode.substr(1), (data.mode[0] === '+'));
            }
        }

        // TODO: Other mode changes that aren't +/- qaohv. - JA
    },
    onUserList: function (e, data) {
        var tab;

        tab = Tabview.getTab(data.channel);
        if (!tab) {
            return;
        }

        if ((!kiwi.front.cache.userlist) || (!kiwi.front.cache.userlist.updating)) {
            if (!kiwi.front.cache.userlist) {
                kiwi.front.cache.userlist = {updating: true};
            } else {
                kiwi.front.cache.userlist.updating = true;
            }
            tab.userlist.empty();
        }

        tab.userlist.addUser(data.users);

    },
    onUserListEnd: function (e, data) {
        if (!kiwi.front.cache.userlist) {
            kiwi.front.cache.userlist = {};
        }
        kiwi.front.cache.userlist.updating = false;
    },

    onChannelListStart: function (e, data) {
        /*global Utilityview */
        var tab, table;

        tab = new Utilityview('Channel List');
        tab.div.css('overflow-y', 'scroll');
        table = $('<table style="margin:1em 2em;"><thead style="font-weight: bold;"><tr><td>Channel Name</td><td>Members</td><td style="padding-left: 2em;">Topic</td></tr></thead><tbody style="vertical-align: top;"></tbody>');
        tab.div.append(table);

        kiwi.front.cache.list = {chans: [], tab: tab, table: table,
            update: function (newChans) {
                var body = this.table.children('tbody:first').detach(),
                    chan,
                    html;

                html = '';
                for (chan in newChans) {
                    this.chans.push(newChans[chan]);
                    html += newChans[chan].html;
                }
                body.append(html);
                this.table.append(body);

            },
            finalise: function () {
                var body = this.table.children('tbody:first').detach(),
                    list,
                    chan;

                list = $.makeArray($(body).children());

                for (chan in list) {
                    list[chan] = $(list[chan]).detach();
                }

                list = _.sortBy(list, function (channel) {
                    return parseInt(channel.children('.num_users').first().text(), 10);
                }).reverse();

                for (chan in list) {
                    body.append(list[chan]);
                }

                this.table.append(body);

            }};
    },
    onChannelList: function (e, data) {
        var chans;
        data = data.chans;
        //data = [data];
        for (chans in data) {
            data[chans] = {data: data[chans], html: '<tr><td><a class="chan">' + data[chans].channel + '</a></td><td class="num_users" style="text-align: center;">' + data[chans].num_users + '</td><td style="padding-left: 2em;">' + kiwi.front.formatIRCMsg(data[chans].topic) + '</td></tr>'};
        }
        kiwi.front.cache.list.update(data);
    },
    onChannelListEnd: function (e, data) {
        kiwi.front.cache.list.finalise();
        kiwi.front.cache.list.tab.show();
    },

    onBanList: function (e, data) {
    },

    onBanListEnd: function (e, data) {
    },

    onJoin: function (e, data) {
        var tab = Tabview.getTab(data.channel);
        if (!tab) {
            tab = new Tabview(data.channel.toLowerCase());
        }

        tab.addMsg(null, ' ', '--> ' + data.nick + ' has joined', 'action join', 'color:#009900;');

        if (data.nick === kiwi.gateway.nick) {
            return; // Not needed as it's already in nicklist
        }

        tab.userlist.addUser({nick: data.nick, modes: []});
    },
    onPart: function (e, data) {
        var tab = Tabview.getTab(data.channel);
        if (tab) {
            // If this is us, close the tabview
            if (data.nick === kiwi.gateway.nick) {
                tab.close();
                Tabview.getServerTab().show();
                return;
            }

            tab.addMsg(null, ' ', '<-- ' + data.nick + ' has left (' + data.message + ')', 'action part', 'color:#990000;');
            tab.userlist.removeUser(data.nick);
        }
    },
    onKick: function (e, data) {
        var tab = Tabview.getTab(data.channel);
        if (tab) {
            // If this is us, close the tabview
            if (data.kicked === kiwi.gateway.nick) {
                //tab.close();
                tab.addMsg(null, ' ', '=== You have been kicked from ' + data.channel + '. ' + data.message, 'status kick');
                tab.safe_to_close = true;
                tab.userlist.remove();
                return;
            }

            tab.addMsg(null, ' ', '<-- ' + data.kicked + ' kicked by ' + data.nick + '(' + data.message + ')', 'action kick', 'color:#990000;');
            tab.userlist.removeUser(data.nick);
        }
    },
    onNick: function (e, data) {
        if (data.nick === kiwi.gateway.nick) {
            kiwi.gateway.nick = data.newnick;
            kiwi.front.ui.doLayout();
        }

        _.each(Tabview.getAllTabs(), function (tab) {
            if (tab.userlist.hasUser(data.nick)) {
                tab.userlist.renameUser(data.nick, data.newnick);
                tab.addMsg(null, ' ', '=== ' + data.nick + ' is now known as ' + data.newnick, 'action changenick');
            }
        });
    },
    onQuit: function (e, data) {
        _.each(Tabview.getAllTabs(), function (tab) {
            if (tab.userlist.hasUser(data.nick)) {
                tab.userlist.removeUser(data.nick);
                tab.addMsg(null, ' ', '<-- ' + data.nick + ' has quit (' + data.message + ')', 'action quit', 'color:#990000;');
            }
        });
    },
    onChannelRedirect: function (e, data) {
        var tab = Tabview.getTab(data.from);
        tab.close();
        tab = new Tabview(data.to);
        tab.addMsg(null, ' ', '=== Redirected from ' + data.from, 'action');
    },

    onIRCError: function (e, data) {
        var t_view,
            tab = Tabview.getTab(data.channel);
        if (data.channel !== undefined && tab) {
            t_view = data.channel;
        } else {
            t_view = 'server';
            tab = Tabview.getServerTab();
        }

        switch (data.error) {
        case 'banned_from_channel':
            tab.addMsg(null, ' ', '=== You are banned from ' + data.channel + '. ' + data.reason, 'status');
            if (t_view !== 'server') {
                tab.safe_to_close = true;
            }
            break;
        case 'bad_channel_key':
            tab.addMsg(null, ' ', '=== Bad channel key for ' + data.channel, 'status');
            if (t_view !== 'server') {
                tab.safe_to_close = true;
            }
            break;
        case 'invite_only_channel':
            tab.addMsg(null, ' ', '=== ' + data.channel + ' is invite only.', 'status');
            if (t_view !== 'server') {
               tab.safe_to_close = true;
            }
            break;
        case 'channel_is_full':
            tab.addMsg(null, ' ', '=== ' + data.channel + ' is full.', 'status');
            if (t_view !== 'server') {
                tab.safe_to_close = true;
            }
            break;
        case 'chanop_privs_needed':
            tab.addMsg(null, ' ', '=== ' + data.reason, 'status');
            break;
        case 'no_such_nick':
            Tabview.getServerTab().addMsg(null, ' ', '=== ' + data.nick + ': ' + data.reason, 'status');
            break;
        case 'nickname_in_use':
            Tabview.getServerTab().addMsg(null, ' ', '=== The nickname ' + data.nick + ' is already in use. Please select a new nickname', 'status');
            kiwi.front.ui.showChangeNick('That nick is already taken');
            break;
        default:
            // We don't know what data contains, so don't do anything with it.
            //kiwi.front.tabviews.server.addMsg(null, ' ', '=== ' + data, 'status');
        }
    },








    onSync: function (e, data) {
        // Set any settings
        if (data.nick !== undefined) {
            kiwi.gateway.nick = data.nick;
        }

        // Add the tabviews
        if (data.tabviews !== undefined) {
            _.each(data.tabviews, function (tab) {
                var newTab;
                if (!Tabview.tabExists(tab.name)) {
                    newTab = new Tabview(kiwi.gateway.channel_prefix + tab.name);

                    if (tab.userlist !== undefined) {
                        kiwi.front.events.onUserList({'channel': kiwi.gateway.channel_prefix + tab.name, 'users': tab.userlist.getUsers(false)});
                    }
                }
            });
        }

        kiwi.front.ui.doLayout();
    }


};
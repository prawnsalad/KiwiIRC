/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi, _, io, $, iScroll, agent, touchscreen, init_data, plugs, plugins, registerTouches, randomString */
kiwi.front = {
    cur_channel: '',
    windows: {},
    tabviews: {},
    utilityviews: {},
    boxes: {},

    buffer: [],
    buffer_pos: 0,

    cache: {},

    original_topic: '',

    init: function () {
        /*global Box, touch_scroll:true, Tabview */
        var about_info, supportsOrientationChange, orientationEvent, scroll_opts, server_tabview;
        kiwi.gateway.nick = 'kiwi_' + Math.ceil(100 * Math.random()) + Math.ceil(100 * Math.random());
        kiwi.gateway.session_id = null;

        $(kiwi.gateway).bind("onmsg", kiwi.front.onMsg);
        $(kiwi.gateway).bind("onnotice", kiwi.front.onNotice);
        $(kiwi.gateway).bind("onaction", kiwi.front.onAction);
        $(kiwi.gateway).bind("onmotd", kiwi.front.onMOTD);
        $(kiwi.gateway).bind("onoptions", kiwi.front.onOptions);
        $(kiwi.gateway).bind("onconnect", kiwi.front.onConnect);
        $(kiwi.gateway).bind("onconnect_fail", kiwi.front.onConnectFail);
        $(kiwi.gateway).bind("ondisconnect", kiwi.front.onDisconnect);
        $(kiwi.gateway).bind("onreconnecting", kiwi.front.onReconnecting);
        $(kiwi.gateway).bind("onnick", kiwi.front.onNick);
        $(kiwi.gateway).bind("onuserlist", kiwi.front.onUserList);
        $(kiwi.gateway).bind("onuserlist_end", kiwi.front.onUserListEnd);
        $(kiwi.gateway).bind("onlist_start", kiwi.front.onChannelListStart);
        $(kiwi.gateway).bind("onlist_channel", kiwi.front.onChannelList);
        $(kiwi.gateway).bind("onlist_end", kiwi.front.onChannelListEnd);
        $(kiwi.gateway).bind("onjoin", kiwi.front.onJoin);
        $(kiwi.gateway).bind("ontopic", kiwi.front.onTopic);
        $(kiwi.gateway).bind("onpart", kiwi.front.onPart);
        $(kiwi.gateway).bind("onkick", kiwi.front.onKick);
        $(kiwi.gateway).bind("onquit", kiwi.front.onQuit);
        $(kiwi.gateway).bind("onmode", kiwi.front.onMode);
        $(kiwi.gateway).bind("onwhois", kiwi.front.onWhois);
        $(kiwi.gateway).bind("onsync", kiwi.front.onSync);
        $(kiwi.gateway).bind("onchannel_redirect", kiwi.front.onChannelRedirect);
        $(kiwi.gateway).bind("ondebug", kiwi.front.onDebug);
        $(kiwi.gateway).bind("onctcp_request", kiwi.front.onCTCPRequest);
        $(kiwi.gateway).bind("onctcp_response", kiwi.front.onCTCPResponse);
        $(kiwi.gateway).bind("onirc_error", kiwi.front.onIRCError);
        $(kiwi.gateway).bind("onkiwi", kiwi.front.onKiwi);

        this.buffer = [];

        // Build the about box
        kiwi.front.boxes.about = new Box("about");
        about_info = 'UI adapted for ' + agent;
        if (touchscreen) {
            about_info += ' touchscreen ';
        }
        about_info += 'usage';
        $('#tmpl_about_box').tmpl({
            about: about_info
        }).appendTo(kiwi.front.boxes.about.content);

        //$(window).bind("beforeunload", function(){ kiwi.gateway.quit(); });

        if (touchscreen) {
            $('#kiwi').addClass('touchscreen');

            // Single touch scrolling through scrollback for touchscreens
            scroll_opts = {};
            touch_scroll = new iScroll('windows', scroll_opts);
        }

        kiwi.front.registerKeys();

        $('#kiwi .toolbars').resize(kiwi.front.doLayoutSize);
        $(window).resize(kiwi.front.doLayoutSize);

        // Add the resizer for the userlist
        $('<div id="nicklist_resize" style="position:absolute; cursor:w-resize; width:5px;"></div>').appendTo('#kiwi');
        $('#nicklist_resize').draggable({axis: "x", drag: function () {
            var t = $(this),
                ul = $('#kiwi .userlist'),
                new_width = $(document).width() - parseInt(t.css('left'), 10);

            new_width = new_width - parseInt(ul.css('margin-left'), 10);
            new_width = new_width - parseInt(ul.css('margin-right'), 10);

            // Make sure we don't remove the userlist alltogether
            if (new_width < 20) {
                $(this).data('draggable').offset.click.left = 10;
                console.log('whoaa');
            }

            Tabview.getCurrentTab().userlist.setWidth(new_width);
            $('#windows').css('right', ul.outerWidth(true));
        }});


        $('#kiwi .formconnectwindow').submit(function () {
            var netsel = $('#kiwi .formconnectwindow .network'),
                netport = $('#kiwi .formconnectwindow .port'),
                netssl = $('#kiwi .formconnectwindow .ssl'),
                nick = $('#kiwi .formconnectwindow .nick'),
                tmp;

            if (nick.val() === '') {
                nick.val('Nick please!');
                nick.focus();
                return false;
            }

            tmp = nick.val().split(' ');
            kiwi.gateway.nick = tmp[0];

            init_data.channel = $('#channel').val();

            kiwi.front.doLayout();
            try {
                kiwi.front.run('/connect ' + netsel.val() + ' ' + netport.val() + ' ' + (netssl.attr('checked') ? 'true' : ''));
            } catch (e) {
                console.log(e);
            }

            $('#kiwi .connectwindow').slideUp('', kiwi.front.barsShow);
            $('#windows').click(function () { $('#kiwi_msginput').focus(); });

            return false;
        });

        supportsOrientationChange = (typeof window.onorientationchange !==  undefined);
        orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";
        if (window.addEventListener) {
            window.addEventListener(orientationEvent, kiwi.front.doLayoutSize, false);
        } else {
            // < IE9
            window.attachEvent(orientationEvent, kiwi.front.doLayoutSize, false);
        }
        //$('#kiwi').bind("resize", kiwi.front.doLayoutSize, false);

        kiwi.front.doLayout();
        kiwi.front.barsHide();

        server_tabview = new Tabview('server');
        server_tabview.userlist.setWidth(0); // Disable the userlist

        // Any pre-defined nick?
        if (typeof window.init_data.nick === "string") {
            $('#kiwi .formconnectwindow .nick').val(init_data.nick);
        }

        // Any pre-defined channels?
        if (typeof window.init_data.channel === 'string') {
            $('#channel').val(init_data.channel);
        }

        // Fix for Opera inserting a spurious <br/>
        $('#kiwi .cur_topic br').remove();

        $('#kiwi .cur_topic').keydown(function (e) {
            if (e.which === 13) {
                // enter
                e.preventDefault();
                $(this).change();
                $('#kiwi_msginput').focus();
            } else if (e.which === 27) {
                // escape
                e.preventDefault();
                $(this).text(kiwi.front.original_topic);
                $('#kiwi_msginput').focus();
            }
        });
        /*$('.cur_topic').live('keypress', function(e) {
            if (e.keyCode === 13) {
                // enter
                e.preventDefault();
                $(this).change();
                $('#kiwi_msginput').focus();
            } else if (e.keyCode === 27) {
                // escape
                e.preventDefault();
                $(this).text(kiwi.front.original_topic);
            }
        });*/
        $('.cur_topic').live('change', function () {
            var chan, text;
            text = $(this).text();
            if (text !== kiwi.front.original_topic) {
                chan = Tabview.getCurrentTab().name;
                kiwi.gateway.setTopic(chan, text);
            }
        });


        $('#windows a.chan').live('click', function () {
            kiwi.front.joinChannel($(this).text());
            return false;
        });

        kiwi.data.set('chanList', []);

        (function () {
            var i;
            for (i in plugins) {
                kiwi.plugs.loadPlugin(plugins[i]);
            }
        }());
    },

    doLayoutSize: function () {
        var kiwi, toolbars, ul, n_top, n_bottom, nl;
        kiwi = $('#kiwi');

        if (kiwi.width() < 330 && !kiwi.hasClass('small_kiwi')) {
            console.log("switching to small kiwi");
            kiwi.removeClass('large_kiwi');
            kiwi.addClass('small_kiwi');
        } else if (kiwi.width() >= 330 && !kiwi.hasClass('large_kiwi')) {
            kiwi.removeClass('small_kiwi');
            kiwi.addClass('large_kiwi');
        }

        toolbars = $('#kiwi .cur_topic');
        ul = $('#kiwi .userlist');

        n_top = parseInt(toolbars.offset().top, 10) + parseInt(toolbars.outerHeight(true), 10);
        n_bottom = $(document).height() - parseInt($('#kiwi .control').offset().top, 10);

        $('#kiwi .windows').css({top: n_top + 'px', bottom: n_bottom + 'px'});
        ul.css({top: n_top + 'px', bottom: n_bottom + 'px'});

        nl = $('#nicklist_resize');
        nl.css({top: n_top + 'px', bottom: n_bottom + 'px', left: $(document).width() - ul.outerWidth(true)});
    },


    doLayout: function () {
        $('#kiwi .msginput .nick a').text(kiwi.gateway.nick);
        $('#kiwi_msginput').val(' ');
        $('#kiwi_msginput').focus();
    },


    joinChannel: function (chan_name) {
        var chans = chan_name.split(','),
            i,
            chan,
            tab;
        for (i in chans) {
            chan = chans[i];
            tab = Tabview.getTab(chan);
            if ((!tab) || (tab.safe_to_close === true)) {
                kiwi.gateway.join(chan);
                tab = new Tabview(chan);
            } else {
                tab.show();
            }
        }
    },


    run: function (msg) {
        var parts, dest, t, pos, textRange, d, plugin_event, msg_sliced, tab;

        // Run through any plugins
        plugin_event = {command: msg};
        plugin_event = kiwi.plugs.run('command_run', plugin_event);
        if (!plugin_event || typeof plugin_event.command === 'undefined') {
            return;
        }

        // Update msg if it's been changed by any plugins
        msg = plugin_event.command.toString();


        if (msg.substring(0, 1) === '/') {
            console.log("running " + msg);
            parts = msg.split(' ');
            switch (parts[0].toLowerCase()) {
            case '/j':
            case '/join':
                kiwi.front.joinChannel(parts[1]);
                break;

            case '/connect':
            case '/server':
                if (typeof parts[1] === 'undefined') {
                    alert('Usage: /connect servername [port] [ssl]');
                    break;
                }

                if (typeof parts[2] === 'undefined') {
                    parts[2] = 6667;
                }

                if ((typeof parts[3] === 'undefined') || !parts[3] || (parts[3] === 'false') || (parts[3] === 'no')) {
                    parts[3] = false;
                } else {
                    parts[3] = true;
                }

                Tabview.getCurrentTab().addMsg(null, ' ', '=== Connecting to ' + parts[1] + ' on port ' + parts[2] + (parts[3] ? ' using SSL' : '') + '...', 'status');
                kiwi.gateway.connect(parts[1], parts[2], parts[3]);
                break;

            case '/nick':
                console.log("/nick");
                if (parts[1] === undefined) {
                    console.log("calling show nick");
                    kiwi.front.showChangeNick();
                } else {
                    console.log("sending raw");
                    kiwi.gateway.raw(msg.substring(1));
                }
                break;

            case '/part':
                if (typeof parts[1] === "undefined") {
                    if (Tabview.getCurrentTab().safe_to_close) {
                        Tabview.getCurrentTab().close();
                    } else {
                        kiwi.gateway.raw(msg.substring(1) + ' ' + Tabview.getCurrentTab().name);
                    }
                } else {
                    kiwi.gateway.raw(msg.substring(1));
                }
                break;

            case '/names':
                if (typeof parts[1] !== "undefined") {
                    kiwi.gateway.raw(msg.substring(1));
                }
                break;

            case '/debug':
                kiwi.gateway.debug();
                break;

            case '/q':
            case '/query':
                if (typeof parts[1] !== "undefined") {
                    tab = new Tabview(parts[1]);
                }
                break;


            case '/m':
            case '/msg':
                if (typeof parts[1] !== "undefined") {
                    msg_sliced = msg.split(' ').slice(2).join(' ');
                    kiwi.gateway.msg(parts[1], msg_sliced);

                    tab = Tabview.getTab(parts[1]);
                    if (!tab) {
                        tab = new Tabview(parts[1]);
                    }
                    tab.addMsg(null, kiwi.gateway.nick, msg_sliced);
                }
                break;

            case '/k':
            case '/kick':
                if (typeof parts[1] === 'undefined') {
                    return;
                }
                kiwi.gateway.raw('KICK ' + Tabview.getCurrentTab().name + ' ' + msg.split(' ', 2)[1]);
                break;

            case '/quote':
                kiwi.gateway.raw(msg.replace(/^\/quote /i, ''));
                break;

            case '/me':
                tab = Tabview.getCurrentTab();
                kiwi.gateway.action(tab.name, msg.substring(4));
                //tab.addMsg(null, ' ', '* '+data.nick+' '+data.msg, 'color:green;');
                tab.addMsg(null, ' ', '* ' + kiwi.gateway.nick + ' ' + msg.substring(4), 'action', 'color:#555;');
                break;

            case '/notice':
                dest = parts[1];
                msg = parts.slice(2).join(' ');

                kiwi.gateway.notice(dest, msg);
                this.onNotice({}, {nick: kiwi.gateway.nick, channel: dest, msg: msg});
                break;

            case '/win':
                if (parts[1] !== undefined) {
                    kiwi.front.windowsShow(parseInt(parts[1], 10));
                }
                break;

            case '/quit':
                kiwi.gateway.quit(parts.slice(1).join(' '));
                break;

            case '/topic':
                if (parts[1] === undefined) {
                    t = $('.cur_topic');
                    if (t.createTextRange) {
                        pos = t.text().length();
                        textRange = t.createTextRange();
                        textRange.collapse(true);
                        textRange.moveEnd(pos);
                        textRange.moveStart(pos);
                        textRange.select();
                    } else if (t.setSelectionRange) {
                        t.setSelectionRange(pos, pos);
                    }
                } else {
                    kiwi.gateway.setTopic(Tabview.getCurrentTab().name, msg.split(' ', 2)[1]);
                    //kiwi.gateway.raw('TOPIC ' + Tabview.getCurrentTab().name + ' :' + msg.split(' ', 2)[1]);
                }
                break;

            case '/kiwi':
                kiwi.gateway.kiwi(Tabview.getCurrentTab().name, msg.substring(6));
                break;

            case '/ctcp':
                parts = parts.slice(1);
                dest = parts.shift();
                msg = parts.join(' ');

                kiwi.gateway.msg(dest, String.fromCharCode(1) + msg + String.fromCharCode(1));
                Tabview.getServerTab().addMsg(null, 'CTCP Request', '[to ' + dest + '] ' + msg, 'ctcp');
                break;
            default:
                //Tabview.getCurrentTab().addMsg(null, ' ', '--> Invalid command: '+parts[0].substring(1));
                kiwi.gateway.raw(msg.substring(1));
            }

        } else {
            //alert('Sending message: '+msg);
            if (msg.trim() === '') {
                return;
            }
            if (Tabview.getCurrentTab().name !== 'server') {
                kiwi.gateway.msg(Tabview.getCurrentTab().name, msg);
                d = new Date();
                d = d.getHours() + ":" + d.getMinutes();
                //kiwi.front.addMsg(d, kiwi.gateway.nick, msg);
                Tabview.getCurrentTab().addMsg(null, kiwi.gateway.nick, msg);
            }
        }
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
                kiwi.front.doLayout();
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
        var err_box, f, msg;

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

        // TODO: convert seconds to mins:secs
        msg = f(data.attempts) + ' attempt at reconnecting in ' + (data.delay / 1000).toString() + ' seconds..';
        err_box.text(msg);
    },
    onOptions: function (e, data) {
        if (typeof kiwi.gateway.network_name === "string" && kiwi.gateway.network_name !== "") {
            Tabview.getServerTab().tab.text(kiwi.gateway.network_name);
        }
    },
    onMOTD: function (e, data) {
        Tabview.getServerTab().addMsg(null, data.server, data.msg, 'motd');
    },
    onWhois: function (e, data) {
        var d, tab;
        tab = Tabview.getCurrentTab();
        if (data.msg) {
            tab.addMsg(null, data.nick, data.msg, 'whois');
        } else if (data.logon) {
            d = new Date();
            d.setTime(data.logon * 1000);
            d = d.toLocaleString();
            tab.addMsg(null, data.nick, 'idle for ' + data.idle + ' second' + ((data.idle !== 1) ? 's' : '') + ', signed on ' + d, 'whois');
        } else {
            tab.addMsg(null, data.nick, 'idle for ' + data.idle + ' seconds', 'whois');
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
            kiwi.front.doLayout();
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
            kiwi.front.showChangeNick('That nick is already taken');
            break;
        default:
            // We don't know what data contains, so don't do anything with it.
            //kiwi.front.tabviews.server.addMsg(null, ' ', '=== ' + data, 'status');
        }
    },

    registerKeys: function () {
        var tabcomplete = {active: false, data: [], prefix: ''};
        $('#kiwi_msginput').bind('keydown', function (e) {
            var windows, meta, num, msg, data, self;
            windows = $('#windows');
            //var meta = e.altKey;
            meta = e.ctrlKey;

            if (e.which !== 9) {
                tabcomplete.active = false;
                tabcomplete.data = [];
                tabcomplete.prefix = '';
            }

            switch (true) {
            case (e.which >= 48) && (e.which <= 57):
                if (meta) {
                    num = e.which - 48;
                    if (num === 0) {
                        num = 10;
                    }
                    num = num - 1;
                    kiwi.front.windowsShow(num);
                    return false;
                }
                break;
            case e.which === 27:            // escape                    
                return false;
            case e.which === 13:            // return
                msg = $('#kiwi_msginput').val();
                msg = msg.trim();

                kiwi.front.buffer.push(msg);
                kiwi.front.buffer_pos = kiwi.front.buffer.length;

                kiwi.front.run(msg);
                $('#kiwi_msginput').val('');

                break;
            case e.which === 33:             // page up
                console.log("page up");
                windows[0].scrollTop = windows[0].scrollTop - windows.height();
                return false;
            case e.which === 34:             // page down
                windows[0].scrollTop = windows[0].scrollTop + windows.height();
                return false;
            case e.which === 37:            // left
                if (meta) {
                    kiwi.front.windowsPrevious();
                    return false;
                }
                break;
            case e.which === 38:            // up
                if (kiwi.front.buffer_pos > 0) {
                    kiwi.front.buffer_pos--;
                    $('#kiwi_msginput').val(kiwi.front.buffer[kiwi.front.buffer_pos]);
                }
                break;
            case e.which === 39:            // right
                if (meta) {
                    kiwi.front.windowsNext();
                    return false;
                }
                break;
            case e.which === 40:            // down
                if (kiwi.front.buffer_pos < kiwi.front.buffer.length) {
                    kiwi.front.buffer_pos++;
                    $('#kiwi_msginput').val(kiwi.front.buffer[kiwi.front.buffer_pos]);
                }
                break;

            case e.which === 9:                // tab
                tabcomplete.active = true;
                if (_.isEqual(tabcomplete.data, [])) {
                    // Get possible autocompletions
                    data = [];
                    Tabview.getCurrentTab().userlist.listUsers(false).each(function () {
                        var nick;
                        nick = kiwi.front.nickStripPrefix($('a.nick', this).text());
                        data.push(nick);
                    });
                    data = _.sortBy(data, function (nick) {
                        return nick;
                    });
                    tabcomplete.data = data;
                }

                if (this.value[this.selectionStart - 1] === ' ') {
                    return false;
                }
                self = this;
                (function () {
                    var tokens = self.value.substring(0, self.selectionStart).split(" "),
                        val,
                        p1,
                        newnick,
                        range,
                        nick = tokens[tokens.length - 1];
                    if (tabcomplete.prefix === '') {
                        tabcomplete.prefix = nick;
                    }

                    tabcomplete.data = _.select(tabcomplete.data, function (n) {
                        return (n.toLowerCase().indexOf(tabcomplete.prefix.toLowerCase()) === 0);
                    });

                    if (tabcomplete.data.length > 0) {
                        p1 = self.selectionStart - (nick.length);
                        val = self.value.substr(0, p1);
                        newnick = tabcomplete.data.shift();
                        tabcomplete.data.push(newnick);
                        val += newnick;
                        val += self.value.substr(self.selectionStart);
                        self.value = val;
                        if (self.setSelectionRange) {
                            self.setSelectionRange(p1 + newnick.length, p1 + newnick.length);
                        } else if (self.createTextRange) { // not sure if this bit is actually needed....
                            range = self.createTextRange();
                            range.collapse(true);
                            range.moveEnd('character', p1 + newnick.length);
                            range.moveStart('character', p1 + newnick.length);
                            range.select();
                        }
                    }
                }());
                return false;
            }
        });


        $('#kiwi .control .msginput .nick').click(function () {
            kiwi.front.showChangeNick();
        });





        $('#kiwi .plugins .load_plugin_file').click(function () {
            if (typeof kiwi.front.boxes.plugins !== "undefined") {
                return;
            }

            kiwi.front.boxes.plugins = new Box("plugin_file");
            $('#tmpl_plugins').tmpl({}).appendTo(kiwi.front.boxes.plugins.content);
            kiwi.front.boxes.plugins.box.css('top', -(kiwi.front.boxes.plugins.height + 40));

            // Populate the plugin list..
            function enumPlugins() {
                var lst, j, txt;
                lst = $('#plugin_list');
                lst.find('option').remove();
                for (j in kiwi.plugs.loaded) {
                    txt = kiwi.plugs.loaded[j].name;
                    lst.append('<option value="' + txt + '">' + txt + '</option>');
                }
            }
            enumPlugins();

            // Event bindings
            $('#kiwi .plugin_file').submit(function () {
                $('<div></div>').load($('.txtpluginfile').val(), function (e) {
                    enumPlugins();
                });
                return false;
            });
            $('#kiwi .cancelpluginfile').click(function () {
                kiwi.front.boxes.plugins.destroy();
            });

            $('#kiwi #plugins_list_unload').click(function () {
                var selected_plugin;
                selected_plugin = $('#plugin_list').val();
                kiwi.plugs.unloadPlugin(selected_plugin);
                enumPlugins();
            });

            $('#kiwi .txtpluginfile').focus();

        });

        $('#kiwi .plugins .reload_css').click(function () {
            var links = document.getElementsByTagName("link"),
                i;
            for (i = 0; i < links.length; i++) {
                if (links[i].rel === "stylesheet") {
                    if (links[i].href.indexOf("?") === -1) {
                        links[i].href += "?";
                    }
                    links[i].href += "x";
                }
            }
        });


        $('#kiwi .about .about_close').click(function () {
            $('#kiwi .about').css('display', 'none');
        });


        $('#kiwi .poweredby').click(function () {
            $('#kiwi .about').css('display', 'block');
        });

    },


    showChangeNick: function (caption) {
        caption = (typeof caption !== 'undefined') ? caption : '';

        $('#kiwi').append($('#tmpl_change_nick').tmpl({}));

        $('#kiwi .newnick .caption').text(caption);

        $('#kiwi .form_newnick').submit(function () {
            kiwi.front.run('/NICK ' + $('#kiwi .txtnewnick').val());
            $('#kiwi .newnick').remove();
            return false;
        });

        $('#kiwi .txtnewnick').keypress(function (ev) {
            if (!this.first_press) {
                this.first_press = true;
                return false;
            }
        });

        $('#kiwi .txtnewnick').keydown(function (ev) {
            if (ev.which === 27) {  // ESC
                $('#kiwi_msginput').focus();
                $('#kiwi .newnick').remove();
            }
        });

        $('#kiwi .cancelnewnick').click(function () {
            $('#kiwi .newnick').remove();
        });

        $('#kiwi .txtnewnick').focus();
    },


    sync: function () {
        kiwi.gateway.sync();
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
                        kiwi.front.onUserList({'channel': kiwi.gateway.channel_prefix + tab.name, 'users': tab.userlist.getUsers(false)});
                    }
                }
            });
        }

        kiwi.front.doLayout();
    },


    setTopicText: function (new_topic) {
        kiwi.front.original_topic = new_topic;
        $('#kiwi .cur_topic .topic').text(new_topic);
        kiwi.front.doLayoutSize();
    },

    nickStripPrefix: function (nick) {
        var tmp = nick, i, j, k;
        i = 0;
        for (j = 0; j < nick.length; j++) {
            for (k = 0; k < kiwi.gateway.user_prefixes.length; k++) {
                if (nick.charAt(j) === kiwi.gateway.user_prefixes[k].symbol) {
                    i++;
                    break;
                }
            }
        }

        return tmp.substr(i);
    },

    nickGetPrefix: function (nick) {
        var tmp = nick, i, j, k;
        i = 0;
        for (j = 0; j < nick.length; j++) {
            for (k = 0; k < kiwi.gateway.user_prefixes.length; k++) {
                if (nick.charAt(j) === kiwi.gateway.user_prefixes[k].symbol) {
                    i++;
                    break;
                }
            }
        }

        return tmp.substr(0, i);
    },

    isChannel: function (name) {
        var prefix, is_chan;
        prefix = name.charAt(0);
        if (kiwi.gateway.channel_prefix.indexOf(prefix) > -1) {
            is_chan = true;
        } else {
            is_chan = false;
        }

        return is_chan;
    },

    tabviewsNext: function () {
        var wl = $('#kiwi .windowlist ul'),
            next_left = parseInt(wl.css('text-indent').replace('px', ''), 10) + 170;
        wl.css('text-indent', next_left);
    },

    tabviewsPrevious: function () {
        var wl = $('#kiwi .windowlist ul'),
            next_left = parseInt(wl.css('text-indent').replace('px', ''), 10) - 170;
        wl.css('text-indent', next_left);
    },

    windowsNext: function () {
        var tab, tabs, curTab, next;
        next = false;
        tabs = Tabview.getAllTabs();
        curTab = Tabview.getCurrentTab();
        for (tab in tabs) {
            if (!next) {
                if (tabs[tab] === curTab) {
                    next = true;
                    continue;
                }
            } else {
                tabs[tab].show();
                return;
            }
        }
    },

    windowsPrevious: function () {
        var tab, tabs, curTab, prev_tab, next;
        next = false;
        tabs = Tabview.getAllTabs();
        curTab = Tabview.getCurrentTab();
        for (tab in tabs) {
            if (tabs[tab] === curTab) {
                if (prev_tab) {
                    prev_tab.show();
                }
                return;
            }
            prev_tab = tabs[tab];
        }
    },

    windowsShow: function (num) {
        num = parseInt(num, 10);
        console.log('Showing window ' + num.toString());
        var i = 0, tab, tabs;
        tabs = Tabview.getAllTabs();
        for (tab in tabs) {
            if (i === num) {
                tabs[tab].show();
                return;
            }
            i++;
        }
    },



    barsShow: function () {
        $('#kiwi .toolbars').slideDown();
        $('#kiwi .control').slideDown();
    },

    barsHide: function () {
        $('#kiwi .toolbars').slideUp();
        $('#kiwi .control').slideUp();
    },

    formatIRCMsg: function (msg) {
        var re, next;

        if ((!msg) || (typeof msg !== 'string')) {
            return;
        }

        // bold
        if (msg.indexOf(String.fromCharCode(2)) !== -1) {
            next = '<b>';
            while (msg.indexOf(String.fromCharCode(2)) !== -1) {
                msg = msg.replace(String.fromCharCode(2), next);
                next = (next === '<b>') ? '</b>' : '<b>';
            }
            if (next === '</b>') {
                msg = msg + '</b>';
            }
        }

        // underline
        if (msg.indexOf(String.fromCharCode(31)) !== -1) {
            next = '<u>';
            while (msg.indexOf(String.fromCharCode(31)) !== -1) {
                msg = msg.replace(String.fromCharCode(31), next);
                next = (next === '<u>') ? '</u>' : '<u>';
            }
            if (next === '</u>') {
                msg = msg + '</u>';
            }
        }

        // colour
        re = /\x03([0-9][0-5]?)(,([0-9][0-5]?))?(.*?)\x03/g;

        msg = msg.replace(re, function (str, p1, p2, p3, p4) {
            var fg, bg,
                col = function (num) {
                    switch (parseInt(num, 10)) {
                    case 0:
                        return '#FFFFFF';
                    case 1:
                        return '#000000';
                    case 2:
                        return '#000080';
                    case 3:
                        return '#008000';
                    case 4:
                        return '#FF0000';
                    case 5:
                        return '#800040';
                    case 6:
                        return '#800080';
                    case 7:
                        return '#FF8040';
                    case 8:
                        return '#FFFF00';
                    case 9:
                        return '#80FF00';
                    case 10:
                        return '#008080';
                    case 11:
                        return '#00FFFF';
                    case 12:
                        return '#0000FF';
                    case 13:
                        return '#FF55FF';
                    case 14:
                        return '#808080';
                    case 15:
                        return '#C0C0C0';
                    default:
                        return null;
                    }
                };
            fg = col(p1);
            bg = col(p3);
            return '<span style="' + ((fg !== null) ? 'color: ' + fg + '; ' : '') + ((bg !== null) ? 'background-color: ' + bg + ';' : '') + '">' + p4 + '</span>';
        });
        return msg;
    }

};










var UserList = function (name) {
    var userlist, list_html, sortUsers, sortModes, getPrefix;

    userlist = [];

    $('#kiwi .userlist').append($('<ul id="kiwi_userlist_' + name + '"></ul>'));
    list_html = $('#kiwi_userlist_' + name);
    $('a.nick', list_html[0]).live('click', this.clickHandler);

    sortUsers = function () {
        var parent;
        parent = list_html.parent();
        list_html = list_html.detach();

        // Not sure this is needed. 
        // It's O(n^2) as well, so need to test to see if it works without.
        // Alternative to test: list_html.children('li').detach();
        list_html.children().each(function (child) {
            var i, nick;
            child = $(child);
            nick = child.data('nick');
            for (i = 0; i < userlist.length; i++) {
                if (userlist[i].nick === nick) {
                    userlist[i].html = child.detach();
                    break;
                }
            }
        });

        userlist.sort(function (a, b) {
            var i, a_idx, b_idx, a_nick, b_nick;
            // Try to sort by modes first
            if (a.modes.length > 0) {
                // a has modes, but b doesn't so a should appear first
                if (b.modes.length === 0) {
                    return -1;
                }
                a_idx = b_idx = -1;
                // Compare the first (highest) mode
                for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                    if (kiwi.gateway.user_prefixes[i].mode === a.modes[0]) {
                        a_idx = i;
                    }
                }
                for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                    if (kiwi.gateway.user_prefixes[i].mode === b.modes[0]) {
                        b_idx = i;
                    }
                }
                if (a_idx < b_idx) {
                    return -1;
                } else if (a_idx > b_idx) {
                    return 1;
                }
                // If we get to here both a and b have the same highest mode so have to resort to lexicographical sorting

            } else if (b.modes.length > 0) {
                // b has modes but a doesn't so b should appear first
                return 1;
            }
            a_nick = a.nick.toLocaleUpperCase();
            b_nick = b.nick.toLocaleUpperCase();
            // Lexicographical sorting
            if (a_nick < b_nick) {
                return -1;
            } else if (a_nick > b_nick) {
                return 1;
            } else {
                // This should never happen; both users have the same nick.
                console.log('Something\'s gone wrong somewhere - two users have the same nick!');
                return 0;
            }
        });
        _.each(userlist, function (user) {
            user.html = user.html.appendTo(list_html);
        });

        list_html = list_html.appendTo(parent);
    };

    sortModes = function (modes) {
        return modes.sort(function (a, b) {
            var a_idx, b_idx, i;
            for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                if (kiwi.gateway.user_prefixes[i].mode === a) {
                    a_idx = i;
                }
            }
            for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                if (kiwi.gateway.user_prefixes[i].mode === b) {
                    b_idx = i;
                }
            }
            if (a_idx < b_idx) {
                return -1;
            } else if (a_idx > b_idx) {
                return 1;
            } else {
                return 0;
            }
        });
    };

    getPrefix = function (modes) {
        var prefix = '';
        if (typeof modes[0] !== 'undefined') {
            prefix = _.detect(kiwi.gateway.user_prefixes, function (prefix) {
                return prefix.mode === modes[0];
            });
            prefix = (prefix) ? prefix.symbol : '';
        }
        return prefix;
    };

    this.addUser = function (users) {
        if (!_.isArray(users)) {
            users = [users];
        }
        _.each(users, function (user) {
            var html, prefix = '';
            user.nick = kiwi.front.nickStripPrefix(user.nick);
            user.modes = sortModes(user.modes);
            if (typeof user.modes[0] !== 'undefined') {
                prefix = _.detect(kiwi.gateway.user_prefixes, function (prefix) {
                    return prefix.mode === user.modes[0];
                });
                prefix = (prefix) ? prefix.symbol : '';
            }
            html = $('<li><a class="nick">' + prefix + user.nick + '</a></li>');
            userlist.push({nick: user.nick, modes: user.modes, html: html});
        });
        sortUsers();

        return this;
    };

    this.removeUser = function (nicks) {
        var toRemove;
        if (!_.isArray(nicks)) {
            nicks = [nicks];
        }
        toRemove = _.select(userlist, function (user) {
            return _.any(nicks, function (n) {
                return n === user.nick;
            });
        });

        _.each(toRemove, function (user) {
            user.html.remove();
        });

        userlist = _.difference(userlist, toRemove);

        return this;
    };

    this.renameUser = function (oldNick, newNick) {
        var user = _.detect(userlist, function (u) {
            return u.nick === oldNick;
        });
        if (user) {
            user.nick = newNick;
            user.html.text(getPrefix(user.modes) + newNick);
        }

        sortUsers();

        return this;
    };

    this.listUsers = function (modesort, modes) {
        var users = userlist;
        if (modes) {
            users = _.select(users, function (user) {
                return _.any(modes, function (m) {
                    return _.any(user.modes, function (um) {
                        return m === um;
                    });
                });
            });
        }
        if ((modesort === true) || (typeof modesort === undefined)) {
            return users;
        } else {
            return _.sortBy(users, function (user) {
                return user.nick;
            });
        }
    };

    this.remove = function () {
        list_html.remove();
        list_html = null;
        userlist = null;
    };

    this.empty = function () {
        list_html.children().remove();
        userlist = [];

        return this;
    };

    this.hasUser = function (nick) {
        return _.any(userlist, function (user) {
            return user.nick === nick;
        });
    };

    this.active = function (active) {
        if ((arguments.length === 0) || (active)) {
            list_html.addClass('active');
            list_html.show();
        } else {
            list_html.removeClass('active');
            list_html.hide();
        }

        return this;
    };

    this.changeUserMode = function (nick, mode, add) {
        var user;
        if (this.hasUser(nick)) {
            user  = _.detect(userlist, function (u) {
                return u.nick === nick;
            });

            if ((arguments.length < 3) || (add)) {
                user.modes.push(mode);
            } else {
                user.modes = _.reject(user.modes, function (m) {
                    return m === mode;
                });
            }
            user.modes = sortModes(user.modes);
            user.html.children('a:first').text(getPrefix(user.modes) + user.nick);
            sortUsers();
        }

        return this;
    };
};
UserList.prototype.width = 100;     // 0 to disable
UserList.prototype.setWidth = function (newWidth) {
    var w, u;
    if (typeof newWidth === 'number') {
        this.width = newWidth;
    }

    w = $('#windows');
    u = $('#kiwi .userlist');

    u.width(this.width);

    return this;
};

UserList.prototype.clickHandler = function () {
    var li = $(this).parent();

    // Remove any existing userboxes
    $('#kiwi .userbox').remove();

    if ($(li).data('userbox') === this) {
        $(li).removeData('userbox');
    } else {
        $('#tmpl_user_box').tmpl({nick: kiwi.front.nickStripPrefix($(this).text())}).appendTo(li);

        $('#kiwi .userbox .userbox_query').click(function (ev) {
            var nick = $('#kiwi .userbox_nick').val();
            kiwi.front.run('/query ' + nick);
        });

        $('#kiwi .userbox .userbox_whois').click(function (ev) {
            var nick = $('#kiwi .userbox_nick').val();
            kiwi.front.run('/whois ' + nick);
        });
        $(li).data('userbox', this);
    }
};





/*
 *   MISC VIEW
 */

var Utilityview = function (name) {
    var rand_name = randomString(15),
        tmp_divname = 'kiwi_window_' + rand_name,
        tmp_tabname = 'kiwi_tab_' + rand_name;

    this.name = rand_name;
    this.title = name;
    this.topic = ' ';
    this.panel = $('#panel1');

    if (typeof $('.scroller', this.panel)[0] === 'undefined') {
        this.panel.append('<div id="' + tmp_divname + '" class="messages"></div>');
    } else {
        $('.scroller', this.panel).append('<div id="' + tmp_divname + '" class="messages"></div>');
    }

    this.tab = $('<li id="' + tmp_tabname + '">' + this.title + '</li>');
    this.tab.click(function () {
        kiwi.front.utilityviews[rand_name.toLowerCase()].show();
    });
    $('#kiwi .utilityviewlist ul').append(this.tab);
    kiwi.front.doLayoutSize();

    this.div = $('#' + tmp_divname);
    this.div.css('overflow', 'hidden');

    kiwi.front.utilityviews[rand_name.toLowerCase()] = this;
};

Utilityview.prototype.name = null;
Utilityview.prototype.title = null;
Utilityview.prototype.div = null;
Utilityview.prototype.tab = null;
Utilityview.prototype.topic = ' ';
Utilityview.prototype.panel = null;
Utilityview.prototype.show = function () {
    $('.messages', this.panel).removeClass("active");
    $('#kiwi .userlist ul').removeClass("active");
    $('#kiwi .toolbars ul li').removeClass("active");

    this.panel.css('overflow-y', 'hidden');
    $('#windows').css('right', 0);
    // Activate this tab!
    this.div.addClass('active');
    this.tab.addClass('active');

    this.addPartImage();

    kiwi.front.setTopicText(this.topic);
    kiwi.front.cur_channel = this;

    // If we're using fancy scrolling, refresh it
    if (touch_scroll) {
        touch_scroll.refresh();
    }
};

Utilityview.prototype.setPanel = function (new_panel) {
    this.div.detach();
    this.panel = new_panel;
    this.panel.append(this.div);
    this.show();
};

Utilityview.prototype.close = function () {
    this.div.remove();
    this.tab.remove();

    if (Tabview.getCurrentTab() === this) {
        kiwi.front.tabviews.server.show();
    }
    delete kiwi.front.utilityviews[this.name.toLowerCase()];
};

Utilityview.prototype.addPartImage = function () {
    this.clearPartImage();

    // We can't close this tab, so don't have the close image
    if (this.name === 'server') {
        return;
    }

    var del_html = '<img src="/img/redcross.png" class="tab_part" />';
    this.tab.append(del_html);

    $('.tab_part', this.tab).click(function () {
        if (Tabview.getCurrentTab().name !== 'server') {
            Tabview.getCurrentTab().close();
        }
    });
};

Utilityview.prototype.clearPartImage = function () {
    $('#kiwi .toolbars .tab_part').remove();
};





/*
 *
 *   TABVIEWS
 *
 */


var Tabview = function (v_name) {
    /*global Tabview, UserList */
    var re, htmlsafe_name, tmp_divname, tmp_userlistname, tmp_tabname, userlist_enabled = true;

    if (v_name.charAt(0) === kiwi.gateway.channel_prefix) {
    //if (v_name[0] === kiwi.gateway.channel_prefix) {
        re = new RegExp(kiwi.gateway.channel_prefix, "g");
        htmlsafe_name = v_name.replace(re, 'pre');
        htmlsafe_name = "chan_" + htmlsafe_name;
    } else {
        htmlsafe_name = 'query_' + v_name;
        userlist_enabled = false;
    }

    tmp_divname = 'kiwi_window_' + htmlsafe_name;
    tmp_userlistname = 'kiwi_userlist_' + htmlsafe_name;
    tmp_tabname = 'kiwi_tab_' + htmlsafe_name;

    if (!Tabview.tabExists(v_name)) {
        $('#kiwi .windows .scroller').append('<div id="' + tmp_divname + '" class="messages"></div>');
        //$('#kiwi .userlist').append('<ul id="' + tmp_userlistname + '"></ul>');
        $('#kiwi .windowlist ul').append('<li id="' + tmp_tabname + '">' + v_name + '</li>');
        $('li', $('#kiwi .windowlist ul')[0]).last().bind('click', function () {
            var tab = Tabview.getTab(v_name);
            if (tab) {
                tab.show();
            }
        });
    }
    //$('#kiwi .windowlist ul .window_'+v_name).click(function(){ kiwi.front.windowShow(v_name); });
    //kiwi.front.windowShow(v_name);

    kiwi.front.tabviews[v_name.toLowerCase()] = this;
    this.name = v_name;
    this.div = $('#' + tmp_divname);
    this.userlist = new UserList(htmlsafe_name);
    this.tab = $('#' + tmp_tabname);
    this.panel = $('#panel1');

    if (!userlist_enabled) {
        this.userlist.setWidth(0);
    }
    this.show();

    if (typeof registerTouches === "function") {
        //alert("Registering touch interface");
        //registerTouches($('#'+tmp_divname));
        registerTouches(document.getElementById(tmp_divname));
    }

    kiwi.front.doLayoutSize();
};
Tabview.prototype.name = null;
Tabview.prototype.div = null;
Tabview.prototype.userlist = null;
Tabview.prototype.tab = null;
Tabview.prototype.topic = "";
Tabview.prototype.safe_to_close = false;                // If we have been kicked/banned/etc from this channel, don't wait for a part message
Tabview.prototype.panel = null;

Tabview.prototype.show = function () {
    var w, u;

    $('.messages', this.panel).removeClass("active");
    $('#kiwi .userlist ul').removeClass("active");
    $('#kiwi .toolbars ul li').removeClass("active");

    w = $('#windows');
    u = $('#kiwi .userlist');

    this.panel.css('overflow-y', 'scroll');

    // Set the window size accordingly
    if (this.userlist.width > 0) {
        this.userlist.setWidth();
        w.css('right', u.outerWidth(true));
        this.userlist.active(true);
        // Enable the userlist resizer
        $('#nicklist_resize').css('display', 'block');
    } else {
        w.css('right', 0);
        // Disable the userlist resizer
        $('#nicklist_resize').css('display', 'none');
    }

    this.div.addClass('active');
    this.tab.addClass('active');

    // Add the part image to the tab
    this.addPartImage();

    this.clearHighlight();
    kiwi.front.setTopicText(this.topic);
    kiwi.front.cur_channel = this;

    // If we're using fancy scrolling, refresh it
    if (touch_scroll) {
        touch_scroll.refresh();
    }

    this.scrollBottom();
    if (!touchscreen) {
        $('#kiwi_msginput').focus();
    }
};

Tabview.prototype.close = function () {
    this.div.remove();
    this.userlist.remove();
    this.userlist = null;
    this.tab.remove();

    if (kiwi.front.cur_channel === this) {
        kiwi.front.tabviews.server.show();
    }
    delete kiwi.front.tabviews[this.name.toLowerCase()];
};

Tabview.prototype.addPartImage = function () {
    this.clearPartImage();

    // We can't close this tab, so don't have the close image
    if (this.name === 'server') {
        return;
    }

    var del_html = '<img src="/img/redcross.png" class="tab_part" />';
    this.tab.append(del_html);

    $('.tab_part', this.tab).click(function () {
        if (kiwi.front.isChannel($(this).parent().text())) {
            kiwi.front.run("/part");
        } else {
            // Make sure we don't close the server tab
            if (kiwi.front.cur_channel.name !== 'server') {
                kiwi.front.cur_channel.close();
            }
        }
    });
};

Tabview.prototype.clearPartImage = function () {
    $('#kiwi .toolbars .tab_part').remove();
};

Tabview.prototype.addMsg = function (time, nick, msg, type, style) {
    var self, tmp, d, re, line_msg;

    self = this;

    tmp = {msg: msg, time: time, nick: nick, tabview: this.name};
    tmp = kiwi.plugs.run('addmsg', tmp);
    if (!tmp) {
        return;
    }


    msg = tmp.msg;
    time = tmp.time;
    nick = tmp.nick;

    if (time === null) {
        d = new Date();
        time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");
    }

    // The CSS class (action, topic, notice, etc)
    if (typeof type !== "string") {
        type = '';
    }

    // Make sure we don't have NaN or something
    if (typeof msg !== "string") {
        msg = '';
    }

    // Make the channels clickable
    re = new RegExp('\\B(' + kiwi.gateway.channel_prefix + '[^ ,.\\007]+)', 'g');
    msg = msg.replace(re, function (match) {
        return '<a class="chan">' + match + '</a>';
    });

    msg = kiwi.front.formatIRCMsg(msg);

    // Build up and add the line
    line_msg = $('<div class="msg ' + type + '"><div class="time">' + time + '</div><div class="nick">' + nick + '</div><div class="text" style="' + style + '">' + msg + ' </div></div>');
    this.div.append(line_msg);

    if (!touchscreen) {
        this.scrollBottom();
    } else {
        touch_scroll.refresh();
        //console.log(this.div.attr("scrollHeight") +" - "+ $('#windows').height());
        this.scrollBottom();
        //if(this.div.attr("scrollHeight") > $('#windows').height()){
        //    touch_scroll.scrollTo(0, this.div.height());
        //}
    }
};

Tabview.prototype.scrollBottom = function () {
    var panel = this.panel;
    panel[0].scrollTop = panel[0].scrollHeight;
};

Tabview.prototype.changeNick = function (newNick, oldNick) {
    var inChan = this.userlist.hasUser(oldNick);
    if (inChan) {
        this.userlist.renameUser(oldNick, newNick);
        this.addMsg(null, ' ', '=== ' + oldNick + ' is now known as ' + newNick, 'action changenick');
    }
};
Tabview.prototype.highlight = function () {
    this.tab.addClass('highlight');
};
Tabview.prototype.activity = function () {
    this.tab.addClass('activity');
};
Tabview.prototype.clearHighlight = function () {
    this.tab.removeClass('highlight');
    this.tab.removeClass('activity');
};
Tabview.prototype.changeTopic = function (new_topic) {
    this.topic = new_topic;
    this.addMsg(null, ' ', '=== Topic for ' + this.name + ' is: ' + new_topic, 'topic');
    if (kiwi.front.cur_channel.name === this.name) {
        kiwi.front.setTopicText(new_topic);
    }
};
// Static functions
Tabview.tabExists = function (name) {
    var ret = (typeof kiwi.front.tabviews[name.toLowerCase()] !== 'undefined');
    return ret;
};
Tabview.getTab = function (name) {
    if (Tabview.tabExists(name)) {
        var ret = kiwi.front.tabviews[name.toLowerCase()];
        return ret;
    } else {
        return null;
    }
};
Tabview.getServerTab = function () {
    return kiwi.front.tabviews.server;
};
Tabview.getAllTabs = function () {
    return kiwi.front.tabviews;
};
Tabview.getCurrentTab = function () {
    return kiwi.front.cur_channel;
};

var Box = function (classname) {
    this.id = randomString(10);
    var tmp = $('<div id="' + this.id + '" class="box ' + classname + '"><div class="boxarea"></div></div>');
    $('#kiwi').append(tmp);
    this.box = $('#' + this.id);
    this.content = $('#' + this.id + ' .boxarea');

    this.box.draggable({ stack: ".box" });
    this.content.click(function () {});
    //this.box.click(function(){ $(this)..css });
};
Box.prototype.create = function (name, classname) {

};
Box.prototype.id = null;
Box.prototype.box = null;
Box.prototype.content = null;
Box.prototype.destroy = function () {
    var name;
    this.box.remove();
    for (name in kiwi.front.boxes) {
        if (kiwi.front.boxes[name].id === this.id) {
            delete kiwi.front.boxes[name];
        }
    }
};
Box.prototype.height = function () {
    return this.box.height();
};

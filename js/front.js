/*jslint regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global gateway, io, $, iScroll, agent, touchscreen, init_data, plugs, plugins, registerTouches, randomString */
kiwi.front = {
    revision: 38,
    
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
        /*global Box, touch_scroll:true */
        var about_info, supportsOrientationChange, orientationEvent, scroll_opts;
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
            about: about_info,
            front_revision: kiwi.front.revision,
            gateway_revision: kiwi.gateway.revision
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
                new_width = $(document).width() - parseInt(t.css('left'), 10);
            
            new_width = new_width - parseInt($('#kiwi .userlist').css('margin-left'), 10);
            new_width = new_width - parseInt($('#kiwi .userlist').css('margin-right'), 10);

            // Make sure we don't remove the userlist alltogether
            if (new_width < 20) {
                $(this).data('draggable').offset.click.left = 10;
                console.log('whoaa');
            }

            kiwi.front.cur_channel.setUserlistWidth(new_width);
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
        
        kiwi.front.tabviewAdd('server');
        kiwi.front.tabviews.server.userlist_width = 0; // Disable the userlist
        
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
                chan = kiwi.front.cur_channel.name;
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
            chan;
        for (i in chans) {
            chan = chans[i];
            if (kiwi.front.tabviews[chan.toLowerCase()] === undefined || (kiwi.front.tabviews[chan.toLowerCase()] !== undefined && kiwi.front.tabviews[chan.toLowerCase()].safe_to_close === true)) {
                kiwi.gateway.join(chan);
                kiwi.front.tabviewAdd(chan);
            } else {
                kiwi.front.tabviews[chan.toLowerCase()].show();
            }
        }
    },
    
    
    run: function (msg) {
        var parts, dest, t, pos, textRange, d, plugin_event, msg_sliced;
        
        // Run through any plugins
        plugin_event = {command: msg};
        plugin_event = kiwi.plugs.run('command_run', plugin_event);
        if (!plugin_event || typeof plugin_event.command === 'undefined') {
            return;
        }

        // Update msg if it's been changed by any plugins
        msg = plugin_event.command.toString();

        console.log("running " + msg);
        if (msg.substring(0, 1) === '/') {
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
                
                kiwi.front.cur_channel.addMsg(null, ' ', '=== Connecting to ' + parts[1] + ' on port ' + parts[2] + (parts[3] ? ' using SSL' : '') + '...', 'status');
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
                    if (kiwi.front.cur_channel.safe_to_close) {
                        kiwi.front.cur_channel.close();
                    } else {
                        kiwi.gateway.raw(msg.substring(1) + ' ' + kiwi.front.cur_channel.name);
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
                    kiwi.front.tabviewAdd(parts[1]);
                }
                break;

            
            case '/m':
            case '/msg':
                if (typeof parts[1] !== "undefined") {
                    msg_sliced = msg.split(' ').slice(2).join(' ');
                    kiwi.gateway.msg(parts[1], msg_sliced);

                    if (!kiwi.front.tabviewExists(parts[1])) {
                        kiwi.front.tabviewAdd(parts[1]);
                    }
                    kiwi.front.tabviews[parts[1].toLowerCase()].addMsg(null, kiwi.gateway.nick, msg_sliced);
                }
                break;
            
            case '/k':
            case '/kick':
                if (typeof parts[1] === 'undefined') {
                    return;
                }
                kiwi.gateway.raw('KICK ' + kiwi.front.cur_channel.name + ' ' + msg.split(' ', 2)[1]);
                break;

            case '/quote':
                kiwi.gateway.raw(msg.replace(/^\/quote /i, ''));
                break;
                
            case '/me':
                kiwi.gateway.action(kiwi.front.cur_channel.name, msg.substring(4));
                //kiwi.front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* '+data.nick+' '+data.msg, 'color:green;');
                kiwi.front.cur_channel.addMsg(null, ' ', '* ' + kiwi.gateway.nick + ' ' + msg.substring(4), 'action', 'color:#555;');
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
                    kiwi.gateway.setTopic(kiwi.front.cur_channel.name, msg.split(' ', 2)[1]);
                    //kiwi.gateway.raw('TOPIC ' + kiwi.front.cur_channel.name + ' :' + msg.split(' ', 2)[1]);
                }
                break;

            case '/kiwi':
                kiwi.gateway.kiwi(kiwi.front.cur_channel.name, msg.substring(6));
                break;

            default:
                //kiwi.front.cur_channel.addMsg(null, ' ', '--> Invalid command: '+parts[0].substring(1));
                kiwi.gateway.raw(msg.substring(1));
            }

        } else {
            //alert('Sending message: '+msg);
            if (msg.trim() === '') {
                return;
            }
            if (kiwi.front.cur_channel.name !== 'server') {
                kiwi.gateway.msg(kiwi.front.cur_channel.name, msg);
                d = new Date();
                d = d.getHours() + ":" + d.getMinutes();
                //kiwi.front.addMsg(d, kiwi.gateway.nick, msg);
                kiwi.front.cur_channel.addMsg(null, kiwi.gateway.nick, msg);
            }
        }
    },
    
    
    onMsg: function (e, data) {
        var destination, plugin_event;
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

        if (!kiwi.front.tabviewExists(plugin_event.destination)) {
            kiwi.front.tabviewAdd(plugin_event.destination);
        }
        kiwi.front.tabviews[plugin_event.destination].addMsg(null, plugin_event.nick, plugin_event.msg);
    },
    
    onDebug: function (e, data) {
        if (!kiwi.front.tabviewExists('kiwi_debug')) {
            kiwi.front.tabviewAdd('kiwi_debug');
        }
        kiwi.front.tabviews.kiwi_debug.addMsg(null, ' ', data.msg);
    },
    
    onAction: function (e, data) {
        var destination;
        // Is this message from a user?
        if (data.channel === kiwi.gateway.nick) {
            destination = data.nick;
        } else {
            destination = data.channel;    
        }
        
        if (!kiwi.front.tabviewExists(destination)) {
            kiwi.front.tabviewAdd(destination);
        }
        kiwi.front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* ' + data.nick + ' ' + data.msg, 'action', 'color:#555;');
    },
    
    onTopic: function (e, data) {
        if (kiwi.front.tabviewExists(data.channel)) {
            kiwi.front.tabviews[data.channel.toLowerCase()].changeTopic(data.topic);            
        }
    },
    
    onNotice: function (e, data) {
        var nick = (data.nick === undefined) ? '' : data.nick,
            enick = '[' + nick + ']';

        if (kiwi.front.tabviewExists(data.target)) {
            kiwi.front.tabviews[data.target.toLowerCase()].addMsg(null, enick, data.msg, 'notice');
        } else if (kiwi.front.tabviewExists(nick)) {
            kiwi.front.tabviews[nick.toLowerCase()].addMsg(null, enick, data.msg, 'notice');
        } else {
            kiwi.front.tabviews.server.addMsg(null, enick, data.msg, 'notice');
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
        kiwi.front.tabviews.server.addMsg(null, 'CTCP [' + data.nick + ']', data.msg, 'ctcp');
    },
    
    onCTCPResponse: function (e, data) {
    },

    onKiwi: function (e, data) {
        //console.log(data);
    },
    
    onConnect: function (e, data) {
        if (data.connected) {
            if (kiwi.gateway.nick !== data.nick) {
                kiwi.gateway.nick = data.nick;
                kiwi.front.doLayout();
            }

            kiwi.front.tabviews.server.addMsg(null, ' ', '=== Connected OK :)', 'status');
            if (typeof init_data.channel === "string") {
                kiwi.front.joinChannel(init_data.channel);
            }
            kiwi.plugs.run('connect', {success: true});
        } else {
            kiwi.front.tabviews.server.addMsg(null, ' ', '=== Failed to connect :(', 'status');
            kiwi.plugs.run('connect', {success: false});
        }
    },
    onConnectFail: function (e, data) {
        var reason = (typeof data.reason === 'string') ? data.reason : '';
        kiwi.front.tabviews.server.addMsg(null, '', 'There\'s a problem connecting! (' + reason + ')', 'error');
        kiwi.plugs.run('connect', {success: false});
    },
    onDisconnect: function (e, data) {
        var tab;
        for (tab in kiwi.front.tabviews) {
            kiwi.front.tabviews[tab].addMsg(null, '', 'Disconnected from server!', 'error');
        }
        kiwi.plugs.run('disconnect', {success: false});
    },
    onOptions: function (e, data) {
        if (typeof kiwi.gateway.network_name === "string" && kiwi.gateway.network_name !== "") {
            kiwi.front.tabviews.server.tab.text(kiwi.gateway.network_name);
        }
    },
    onMOTD: function (e, data) {
        kiwi.front.tabviews.server.addMsg(null, data.server, data.msg, 'motd');
    },
    onWhois: function (e, data) {
        var d;
        if (data.msg) {
            kiwi.front.cur_channel.addMsg(null, data.nick, data.msg, 'whois');
        } else if (data.logon) {
            d = new Date();
            d.setTime(data.logon * 1000);
            d = d.toLocaleString();
            kiwi.front.cur_channel.addMsg(null, data.nick, 'idle for ' + data.idle + ' second' + ((data.idle !== 1) ? 's' : '') + ', signed on ' + d, 'whois');
        } else {
            kiwi.front.cur_channel.addMsg(null, data.nick, 'idle for ' + data.idle + ' seconds', 'whois');
        }
    },
    onMode: function (e, data) {
        var i, new_nick_text;
        
        // TODO: Store the modes in the elements data, then work out the current
        // mode symbol from the highest mode. Eg. -h may leave +o from previous modes; It
        // doesn't simply clear it! ~Darren
        if (typeof data.channel === 'string' && typeof data.effected_nick === 'string') {
            kiwi.front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '[' + data.mode + '] ' + data.effected_nick + ' by ' + data.nick, 'mode', '');
            kiwi.front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
                if (kiwi.front.nickStripPrefix($(this).text()) === data.effected_nick) {

                    if (data.mode.split('')[0] === '+') {
                        for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                            if (kiwi.gateway.user_prefixes[i].mode === data.mode.split('')[1]) {
                                new_nick_text = kiwi.gateway.user_prefixes[i].symbol + data.effected_nick;
                                break;
                            }
                        }
                    } else if (data.mode.split('')[0] === '-') {
                        new_nick_text = data.effected_nick;
                    }

                    if (new_nick_text !== '') {
                        $(this).text(new_nick_text);
                        return false;
                    }

                }
            });
        }
    },
    onUserList: function (e, data) {
        var ul, nick, mode;
        if (kiwi.front.tabviews[data.channel.toLowerCase()] === undefined) {
            return;
        }
        ul = kiwi.front.tabviews[data.channel.toLowerCase()].userlist;
        
        if (!document.userlist_updating) {
            document.userlist_updating = true;
            ul.empty();
        }
        
        $.each(data.users, function (i, item) {
            nick = i; //i.match(/^.+!/g);
            mode = item;
            $('<li><a class="nick" onclick="kiwi.front.userClick(this);">' + mode + nick + '</a></li>').appendTo(ul);
        });
        
        kiwi.front.tabviews[data.channel.toLowerCase()].userlistSort();
    },
    onUserListEnd: function (e, data) {
        document.userlist_updating = false;
    },
    
    onChannelListStart: function (e, data) {
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
        console.log(data);
        data = data.chans;
        //data = [data];
        for (chans in data) {
            data[chans] = {data: data[chans], html: '<tr><td><a class="chan">' + data[chans].channel + '</a></td><td class="num_users" style="text-align: center;">' + data[chans].num_users + '</td><td style="padding-left: 2em;">' + kiwi.front.format(data[chans].topic) + '</td></tr>'};
        }
        kiwi.front.cache.list.update(data);
    },
    onChannelListEnd: function (e, data) {
        kiwi.front.cache.list.finalise();
        kiwi.front.cache.list.tab.show();
    },


    onJoin: function (e, data) {
        if (!kiwi.front.tabviewExists(data.channel)) {
            kiwi.front.tabviewAdd(data.channel.toLowerCase());
        }
        
        if (data.nick === kiwi.gateway.nick) {
            return; // Not needed as it's already in nicklist
        }
        kiwi.front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '--> ' + data.nick + ' has joined', 'action join', 'color:#009900;');
        $('<li><a class="nick" onclick="kiwi.front.userClick(this);">' + data.nick + '</a></li>').appendTo(kiwi.front.tabviews[data.channel.toLowerCase()].userlist);
        kiwi.front.tabviews[data.channel.toLowerCase()].userlistSort();
    },
    onPart: function (e, data) {
        if (kiwi.front.tabviewExists(data.channel)) {
            // If this is us, close the tabview
            if (data.nick === kiwi.gateway.nick) {
                kiwi.front.tabviews[data.channel.toLowerCase()].close();
                kiwi.front.tabviews.server.show();
                return;
            }
            
            kiwi.front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.nick + ' has left (' + data.message + ')', 'action part', 'color:#990000;');
            kiwi.front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
                if ($(this).text() === data.nick) {
                    $(this).remove();
                }
            });
        }
    },
    onKick: function (e, data) {
        if (kiwi.front.tabviewExists(data.channel)) {
            // If this is us, close the tabview
            if (data.kicked === kiwi.gateway.nick) {
                //kiwi.front.tabviews[data.channel.toLowerCase()].close();
                kiwi.front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '=== You have been kicked from ' + data.channel + '. ' + data.message, 'status kick');
                kiwi.front.tabviews[data.channel.toLowerCase()].safe_to_close = true;
                $('li', kiwi.front.tabviews[data.channel.toLowerCase()].userlist).remove();
                return;
            }
            
            kiwi.front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.kicked + ' kicked by ' + data.nick + '(' + data.message + ')', 'action kick', 'color:#990000;');
            kiwi.front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
                if ($(this).text() === data.nick) {
                    $(this).remove();
                }
            });
        }
    },
    onNick: function (e, data) {
        if (data.nick === kiwi.gateway.nick) {
            kiwi.gateway.nick = data.newnick;
            kiwi.front.doLayout();
        }
        
        $.each(kiwi.front.tabviews, function (i, item) {
            $.each(kiwi.front.tabviews, function (i, item) {
                item.changeNick(data.newnick, data.nick);
            });
        });
    },
    onQuit: function (e, data) {
        $.each(kiwi.front.tabviews, function (i, item) {
            $.each(kiwi.front.tabviews, function (i, item) {
                item.userlist.children().each(function () {
                    if ($(this).text() === data.nick) {
                        $(this).remove();
                        item.addMsg(null, ' ', '<-- ' + data.nick + ' has quit (' + data.message + ')', 'action quit', 'color:#990000;');
                    }
                });
            });
        });
    },
    onChannelRedirect: function (e, data) {
        kiwi.front.tabviews[data.from.toLowerCase()].close();
        kiwi.front.tabviewAdd(data.to.toLowerCase());
        kiwi.front.tabviews[data.to.toLowerCase()].addMsg(null, ' ', '=== Redirected from ' + data.from, 'action');
    },
    
    onIRCError: function (e, data) {
        var t_view;
        if (data.channel !== undefined && kiwi.front.tabviewExists(data.channel)) {
            t_view = data.channel;
        } else {
            t_view = 'server';
        }

        switch (data.error) {
        case 'banned_from_channel':
            kiwi.front.tabviews[t_view].addMsg(null, ' ', '=== You are banned from ' + data.channel + '. ' + data.reason, 'status');
            if (t_view !== 'server') {
                kiwi.front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'bad_channel_key':
            kiwi.front.tabviews[t_view].addMsg(null, ' ', '=== Bad channel key for ' + data.channel, 'status');
            if (t_view !== 'server') {
                kiwi.front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'invite_only_channel':
            kiwi.front.tabviews[t_view].addMsg(null, ' ', '=== ' + data.channel + ' is invite only.', 'status');
            if (t_view !== 'server') {
                kiwi.front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'channel_is_full':
            kiwi.front.tabviews[t_view].addMsg(null, ' ', '=== ' + data.channel + ' is full.', 'status');
            if (t_view !== 'server') {
                kiwi.front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'chanop_privs_needed':
            kiwi.front.tabviews[data.channel].addMsg(null, ' ', '=== ' + data.reason, 'status');
            break;
        case 'no_such_nick':
            kiwi.front.tabviews.server.addMsg(null, ' ', '=== ' + data.nick + ': ' + data.reason, 'status'); 
            break;
        case 'nickname_in_use':
            kiwi.front.tabviews.server.addMsg(null, ' ', '=== The nickname ' + data.nick + ' is already in use. Please select a new nickname', 'status');
            kiwi.front.showChangeNick();
            break;
        default:
            // We don't know what data contains, so don't do anything with it.
            //kiwi.front.tabviews.server.addMsg(null, ' ', '=== ' + data, 'status');
        }
    },
    
    registerKeys: function () {
        var tabcomplete = {active: false, data: [], prefix: ''};
        $('#kiwi_msginput').bind('keydown', function (e) {
            var windows, meta, num, msg, data, candidates, word_pos, word, i, self;
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
                    kiwi.front.cur_channel.userlist.children().each(function () {
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
                        range;
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
    
    
    showChangeNick: function () {
        $('#kiwi').append($('#tmpl_change_nick').tmpl({}));
        
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


    tabviewExists: function (name) {
        return (typeof kiwi.front.tabviews[name.toLowerCase()] !== 'undefined');
    },
    
    tabviewAdd: function (v_name) {
        /*global Tabview */
        var re, htmlsafe_name, tmp_divname, tmp_userlistname, tmp_tabname, userlist_enabled = true;

        if (v_name.charAt(0) === kiwi.gateway.channel_prefix) {
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
        
        if (!kiwi.front.tabviewExists(v_name)) {
            $('#kiwi .windows .scroller').append('<div id="' + tmp_divname + '" class="messages"></div>');
            $('#kiwi .userlist').append('<ul id="' + tmp_userlistname + '"></ul>');
            $('#kiwi .windowlist ul').append('<li id="' + tmp_tabname + '" onclick="kiwi.front.tabviews[\'' + v_name.toLowerCase() + '\'].show();">' + v_name + '</li>');
        }
        //$('#kiwi .windowlist ul .window_'+v_name).click(function(){ kiwi.front.windowShow(v_name); });
        //kiwi.front.windowShow(v_name);
        
        kiwi.front.tabviews[v_name.toLowerCase()] = new Tabview();
        kiwi.front.tabviews[v_name.toLowerCase()].name = v_name;
        kiwi.front.tabviews[v_name.toLowerCase()].div = $('#' + tmp_divname);
        kiwi.front.tabviews[v_name.toLowerCase()].userlist = $('#' + tmp_userlistname);
        kiwi.front.tabviews[v_name.toLowerCase()].tab = $('#' + tmp_tabname);
        if (!userlist_enabled) {
            kiwi.front.tabviews[v_name.toLowerCase()].userlist_width = 0;
        }
        kiwi.front.tabviews[v_name.toLowerCase()].show();
        
        if (typeof registerTouches === "function") {
            //alert("Registering touch interface");
            //registerTouches($('#'+tmp_divname));
            registerTouches(document.getElementById(tmp_divname));
        }
        /*
        kiwi.front.tabviews[v_name.toLowerCase()].userlist.click(function(){
            alert($(this).attr('id'));
        });
        */

        kiwi.front.doLayoutSize();
    },
    
    
    userClick: function (item) {
        var li = $(item).parent();

        // Remove any existing userboxes
        $('#kiwi .userbox').remove();

        if ($(li).data('userbox') === item) {
            $(li).removeData('userbox');
        } else {
            $('#tmpl_user_box').tmpl({nick: kiwi.front.nickStripPrefix($(item).text())}).appendTo(li);
            
            $('#kiwi .userbox .userbox_query').click(function (ev) {
                var nick = $('#kiwi .userbox_nick').val();
                kiwi.front.run('/query ' + nick);
            });
            
            $('#kiwi .userbox .userbox_whois').click(function (ev) {
                var nick = $('#kiwi .userbox_nick').val();
                kiwi.front.run('/whois ' + nick);
            });
            $(li).data('userbox', item);
        }
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
            $.each(data.tabviews, function (i, tab) {
                if (!kiwi.front.tabviewExists(tab.name)) {
                    kiwi.front.tabviewAdd(kiwi.gateway.channel_prefix + tab.name);
                    
                    if (tab.userlist !== undefined) {
                        kiwi.front.onUserList({'channel': kiwi.gateway.channel_prefix + tab.name, 'users': tab.userlist});
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
        var tmp = nick, i, prefix;
        
        prefix = tmp.charAt(0);
        for (i in kiwi.gateway.user_prefixes) {
            if (kiwi.gateway.user_prefixes[i].symbol === prefix) {
                return tmp.substring(1);
            }
        }

        return tmp;
    },
    
    nickGetPrefix: function (nick) {
        var tmp = nick, i, prefix;
        
        prefix = tmp.charAt(0);
        for (i in kiwi.gateway.user_prefixes) {
            if (kiwi.gateway.user_prefixes[i].symbol === prefix) {
                return prefix;
            }
        }

        return '';
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
        var tab, next;
        next = false;
        for (tab in kiwi.front.tabviews) {
            if (!next) {
                if (kiwi.front.tabviews[tab] === kiwi.front.cur_channel) {
                    next = true;
                    continue;
                }
            } else {
                kiwi.front.tabviews[tab].show();
                return;
            }
        }
    },

    windowsPrevious: function () {
        var tab, prev_tab, next;
        next = false;
        for (tab in kiwi.front.tabviews) {
            if (kiwi.front.tabviews[tab] === kiwi.front.cur_channel) {
                if (prev_tab) {
                    prev_tab.show();
                }
                return;
            }
            prev_tab = kiwi.front.tabviews[tab];
        }
    },

    windowsShow: function (num) {
        num = parseInt(num, 10);
        console.log('Showing window ' + num.toString());
        var i = 0, tab;
        for (tab in kiwi.front.tabviews) {
            if (i === num) {
                kiwi.front.tabviews[tab].show();
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
    
    format: function (msg) {
        var re;
        
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
















/*
 *   MISC VIEW
 */

var Utilityview = function (name) {
    var rand_name = randomString(15),
        tmp_divname = 'kiwi_window_' + rand_name,
        tmp_userlistname = 'kiwi_userlist_' + rand_name,
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
    
    if (kiwi.front.cur_channel === this) {
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
        if (kiwi.front.cur_channel.name !== 'server') {
            kiwi.front.cur_channel.close();
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


var Tabview = function () {
    this.panel = $('#panel1');
};
Tabview.prototype.name = null;
Tabview.prototype.div = null;
Tabview.prototype.userlist = null;
Tabview.prototype.userlist_width = 100;     // 0 for disabled
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

    //w.css('overflow-y', 'scroll');

    // Set the window size accordingly
    this.setUserlistWidth();

    // Activate this tab!
    this.div.addClass('active');
    if (this.userlist_width > 0) {
        this.userlist.addClass('active');
        // Enable the userlist resizer
        $('#nicklist_resize').css('display', 'block');
    } else {
        // Disable the userlist resizer
        $('#nicklist_resize').css('display', 'none');
    }
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
    this.tab.remove();
    
    if (kiwi.front.cur_channel === this) {
        kiwi.front.tabviews.server.show();
    }
    delete kiwi.front.tabviews[this.name.toLowerCase()];
};

Tabview.prototype.setUserlistWidth = function (new_width) {
    var w, u;
    if (typeof new_width === 'number') {
        this.userlist_width = new_width;
    }

    w = $('#windows');
    u = $('#kiwi .userlist');

    // Set the window size accordingly
    if (this.userlist_width > 0) {
        u.width(this.userlist_width);
        w.css('right', u.outerWidth(true));
    } else {
        w.css('right', 0);
    }    
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
    var self, tmp, plugin_ret, i, d, re, line_msg, next;
    
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

    msg = kiwi.front.format(msg);
    
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
    console.log(panel);
    panel[0].scrollTop = panel[0].scrollHeight;
};

Tabview.prototype.changeNick = function (newNick, oldNick) {
    this.userlist.children().each(function () {
        var item = $('a.nick', this);
        if (kiwi.front.nickStripPrefix(item.text()) === oldNick) {
            item.text(kiwi.front.nickGetPrefix(item.text()) + newNick);
            document.temp_chan = 1;
        }
    });
    
    if (typeof document.temp_chan !== "undefined") {
        this.addMsg(null, ' ', '=== ' + oldNick + ' is now known as ' + newNick, 'action changenick');
        delete document.temp_chan;
        this.userlistSort();
    }
};

Tabview.prototype.userlistSort = function () {
    var ul = this.userlist,
        listitems = ul.children('li').get(),
        prefix;
    listitems.sort(function (a, b) {
        var compA = $(a).text().toUpperCase(),
            compB = $(b).text().toUpperCase(),
            i;
        
        // Sort by prefixes first
        for (i in kiwi.gateway.user_prefixes) {
            prefix = kiwi.gateway.user_prefixes[i].symbol;
            
            if (compA.charAt(0) === prefix && compB.charAt(0) === prefix) {
                // Both have the same prefix, string compare time
                return 0;
            }
            
            if (compA.charAt(0) === prefix && compB.charAt(0) !== prefix) {
                return -1;
            }
            
            if (compA.charAt(0) !== prefix && compB.charAt(0) === prefix) {
                return 1;
            }
        }
               
        // No prefixes, compare by string
        return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
    });
    $.each(listitems, function (idx, itm) { ul.append(itm); });
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

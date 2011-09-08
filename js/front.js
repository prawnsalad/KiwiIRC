/*jslint devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global gateway, io, $, iScroll, agent, touchscreen, init_data, plugs, plugins, registerTouches, randomString */
var front = {
    revision: 38,
    
    cur_channel: '',
    windows: {},
    tabviews: {},
    utilityviews: {},
    boxes: {},
    
    buffer: [],
    buffer_pos: 0,

    original_topic: '',
    
    init: function () {
        /*global Box, touch_scroll:true */
        var about_info, supportsOrientationChange, orientationEvent, scroll_opts;
        gateway.nick = 'kiwi_' + Math.ceil(100 * Math.random()) + Math.ceil(100 * Math.random());
        gateway.session_id = null;
        
        $(gateway).bind("onmsg", front.onMsg);
        $(gateway).bind("onnotice", front.onNotice);
        $(gateway).bind("onaction", front.onAction);
        $(gateway).bind("onmotd", front.onMOTD);
        $(gateway).bind("onoptions", front.onOptions);
        $(gateway).bind("onconnect", front.onConnect);
        $(gateway).bind("onconnect_fail", front.onConnectFail);
        $(gateway).bind("ondisconnect", front.onDisconnect);
        $(gateway).bind("onnick", front.onNick);
        $(gateway).bind("onuserlist", front.onUserList);
        $(gateway).bind("onuserlist_end", front.onUserListEnd);
        $(gateway).bind("onjoin", front.onJoin);
        $(gateway).bind("ontopic", front.onTopic);
        $(gateway).bind("onpart", front.onPart);
        $(gateway).bind("onkick", front.onKick);
        $(gateway).bind("onquit", front.onQuit);
        $(gateway).bind("onmode", front.onMode);
        $(gateway).bind("onwhois", front.onWhois);
        $(gateway).bind("onsync", front.onSync);
        $(gateway).bind("onchannel_redirect", front.onChannelRedirect);
        $(gateway).bind("ondebug", front.onDebug);
        $(gateway).bind("onctcp_request", front.onCTCPRequest);
        $(gateway).bind("onctcp_response", front.onCTCPResponse);
        $(gateway).bind("onirc_error", front.onIRCError);
        $(gateway).bind("onkiwi", front.onKiwi);
        
        this.buffer = [];
        
        // Build the about box
        front.boxes.about = new Box("about");
        about_info = 'UI adapted for ' + agent;
        if (touchscreen) {
            about_info += ' touchscreen ';
        }
        about_info += 'usage';
        $('#tmpl_about_box').tmpl({
            about: about_info,
            front_revision: front.revision,
            gateway_revision: gateway.revision
        }).appendTo(front.boxes.about.content);

        //$(window).bind("beforeunload", function(){ gateway.quit(); });
        
        if (touchscreen) {
            $('#kiwi').addClass('touchscreen');

            // Single touch scrolling through scrollback for touchscreens
            scroll_opts = {};
            touch_scroll = new iScroll('windows', scroll_opts);
        }

        front.registerKeys();
        
        $('#kiwi .toolbars').resize(front.doLayoutSize);

        $('#kiwi .formconnectwindow').submit(function () {
            var netsel = $('#kiwi .formconnectwindow .network'),
                nick = $('#kiwi .formconnectwindow .nick'),
                tmp;
            
            if (nick.val() === '') {
                nick.val('Nick please!');
                nick.focus();
                return false;
            }
            
            tmp = nick.val().split(' ');
            gateway.nick = tmp[0];

            init_data.channel = $('#channel').val();

            front.doLayout();
            try {
                front.run('/connect ' + netsel.val());
            } catch (e) {
                alert(e);
            }
            
            $('#kiwi .connectwindow').slideUp('', front.barsShow);
            $('#windows').click(function () { $('#kiwi_msginput').focus(); });

            return false;
        });

        supportsOrientationChange = (typeof window.onorientationchange !==  undefined);
        orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";
        if (window.addEventListener) {
            window.addEventListener(orientationEvent, front.doLayoutSize, false);
        } else {
            // < IE9
            window.attachEvent(orientationEvent, front.doLayoutSize, false);
        }
        //$('#kiwi').bind("resize", front.doLayoutSize, false);

        front.doLayout();
        front.barsHide();
        
        front.tabviewAdd('server');
        front.tabviews.server.userlist_width = 0; // Disable the userlist
        
        // Any pre-defined nick?
        if (typeof window.init_data.nick === "string") {
            $('#kiwi .formconnectwindow .nick').val(init_data.nick);
        }

        // Any pre-defined channels?
        if (typeof window.init_data.channel === 'string') {
            $('#channel').val(init_data.channel);
        }
        
        
        $('#kiwi .cur_topic').keydown(function (e) {
            if (e.which === 13) {
                // enter
                e.preventDefault();
                $(this).change();
                $('#kiwi_msginput').focus();
            } else if (e.which === 27) {
                // escape
                e.preventDefault();
                $(this).text(front.original_topic);
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
                $(this).text(front.original_topic);
            }
        });*/
        $('.cur_topic').live('change', function () {
            var chan, text;
            text = $(this).text();
            if (text !== front.original_topic) {
                chan = front.cur_channel.name;
                gateway.setTopic(chan, text);
            }
        });


        $('#windows a.chan').live('click', function () {
            front.joinChannel($(this).text());
            return false;
        });

        (function () {
            var i;
            for (i in plugins) {
                plugs.loadPlugin(plugins[i]);
            }
        }());
    },
    
    doLayoutSize: function () {
        var kiwi, toolbars, ul, n_top, n_bottom;
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
        $('#kiwi .userlist').css({top: n_top + 'px', bottom: n_bottom + 'px'});
    },


    doLayout: function () {
        $('#kiwi .msginput .nick a').text(gateway.nick);
        $('#kiwi_msginput').val(' ');
        $('#kiwi_msginput').focus();
    },
    
    
    joinChannel: function (chan_name) {
        var chans = chan_name.split(','),
            i,
            chan;
        for (i in chans) {
            chan = chans[i];
            if (front.tabviews[chan.toLowerCase()] === undefined || (front.tabviews[chan.toLowerCase()] !== undefined && front.tabviews[chan.toLowerCase()].safe_to_close === true)) {
                gateway.join(chan);
                front.tabviewAdd(chan);
            } else {
                front.tabviews[chan.toLowerCase()].show();
            }
        }
    },
    
    
    run: function (msg) {
        var parts, dest, t, pos, textRange, d, plugin_event, msg_sliced;
        
        // Run through any plugins
        plugin_event = {command: msg};
        plugin_event = plugs.run('command_run', plugin_event);
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
                front.joinChannel(parts[1]);
                break;
                
            case '/connect':
            case '/server':
                if (parts[1] === undefined) {
                    alert('Usage: /connect servername [port]');
                    break;
                }
                
                if (parts[2] === undefined) {
                    parts[2] = 6667;
                }
                front.cur_channel.addMsg(null, ' ', '=== Connecting to ' + parts[1] + '...', 'status');
                gateway.connect(parts[1], parts[2], 0);
                break;
                
            case '/nick':
                console.log("/nick");
                if (parts[1] === undefined) {
                    console.log("calling show nick");
                    front.showChangeNick();
                } else {
                    console.log("sending raw");
                    gateway.raw(msg.substring(1));
                }
                break;

            case '/part':
                if (typeof parts[1] === "undefined") {
                    if (front.cur_channel.safe_to_close) {
                        front.cur_channel.close();
                    } else {
                        gateway.raw(msg.substring(1) + ' ' + front.cur_channel.name);
                    }
                } else {
                    gateway.raw(msg.substring(1));
                }
                break;
                
            case '/names':
                if (typeof parts[1] !== "undefined") {
                    gateway.raw(msg.substring(1));
                }
                break;
                
            case '/debug':
                gateway.debug();
                break;
                
            case '/q':
            case '/query':
                if (typeof parts[1] !== "undefined") {
                    front.tabviewAdd(parts[1]);
                }
                break;

            
            case '/m':
            case '/msg':
                if (typeof parts[1] !== "undefined") {
                    msg_sliced = msg.split(' ').slice(2).join(' ');
                    gateway.msg(parts[1], msg_sliced);

                    if (!front.tabviewExists(parts[1])) {
                        front.tabviewAdd(parts[1]);
                    }
                    front.tabviews[parts[1].toLowerCase()].addMsg(null, gateway.nick, msg_sliced);
                }
                break;
            
                
            case '/quote':
                gateway.raw(msg.replace(/^\/quote /i, ''));
                break;
                
            case '/me':
                gateway.action(front.cur_channel.name, msg.substring(4));
                //front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* '+data.nick+' '+data.msg, 'color:green;');
                front.cur_channel.addMsg(null, ' ', '* ' + gateway.nick + ' ' + msg.substring(4), 'action', 'color:#555;');
                break;

            case '/notice':
                dest = parts[1];
                msg = parts.slice(2).join(' ');

                gateway.notice(dest, msg);
                this.onNotice({}, {nick: gateway.nick, channel: dest, msg: msg});
                break;

            case '/win':
                if (parts[1] !== undefined) {
                    front.windowsShow(parseInt(parts[1], 10));
                }
                break;

            case '/quit':
                gateway.quit(msg.split(" ", 2)[1]);
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
                    gateway.setTopic(front.cur_channel.name, msg.split(' ', 2)[1]);
                    //gateway.raw('TOPIC ' + front.cur_channel.name + ' :' + msg.split(' ', 2)[1]);
                }
                break;

            case '/kiwi':
                gateway.kiwi(front.cur_channel.name, msg.substring(6));
                break;

            default:
                //front.cur_channel.addMsg(null, ' ', '--> Invalid command: '+parts[0].substring(1));
                gateway.raw(msg.substring(1));
            }

        } else {
            //alert('Sending message: '+msg);
            if (msg.trim() === '') {
                return;
            }
            if (front.cur_channel.name !== 'server') {
                gateway.msg(front.cur_channel.name, msg);
                d = new Date();
                d = d.getHours() + ":" + d.getMinutes();
                //front.addMsg(d, gateway.nick, msg);
                front.cur_channel.addMsg(null, gateway.nick, msg);
            }
        }
    },
    
    
    onMsg: function (e, data) {
        var destination, plugin_event;
        // Is this message from a user?
        if (data.channel === gateway.nick) {
            destination = data.nick.toLowerCase();
        } else {
            destination = data.channel.toLowerCase();    
        }
        
        plugin_event = {nick: data.nick, msg: data.msg, destination: destination};
        plugin_event = plugs.run('msg_recieved', plugin_event);
        if (!plugin_event) {
            return;
        }

        if (!front.tabviewExists(plugin_event.destination)) {
            front.tabviewAdd(plugin_event.destination);
        }
        front.tabviews[plugin_event.destination].addMsg(null, plugin_event.nick, plugin_event.msg);
    },
    
    onDebug: function (e, data) {
        if (!front.tabviewExists('kiwi_debug')) {
            front.tabviewAdd('kiwi_debug');
        }
        front.tabviews.kiwi_debug.addMsg(null, ' ', data.msg);
    },
    
    onAction: function (e, data) {
        var destination;
        // Is this message from a user?
        if (data.channel === gateway.nick) {
            destination = data.nick;
        } else {
            destination = data.channel;    
        }
        
        if (!front.tabviewExists(destination)) {
            front.tabviewAdd(destination);
        }
        front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* ' + data.nick + ' ' + data.msg, 'action', 'color:#555;');
    },
    
    onTopic: function (e, data) {
        if (front.tabviewExists(data.channel)) {
            front.tabviews[data.channel.toLowerCase()].changeTopic(data.topic);            
        }
    },
    
    onNotice: function (e, data) {
        var nick = (data.nick === undefined) ? '' : data.nick,
            enick = '[' + nick + ']';

        if (front.tabviewExists(data.target)) {
            front.tabviews[data.target.toLowerCase()].addMsg(null, enick, data.msg, 'notice');
        } else if (front.tabviewExists(nick)) {
            front.tabviews[nick.toLowerCase()].addMsg(null, enick, data.msg, 'notice');
        } else {
            front.tabviews.server.addMsg(null, enick, data.msg, 'notice');
        }
    },
    
    onCTCPRequest: function (e, data) {
        var msg = data.msg.split(" ", 2);
        switch (msg[0]) {
        case 'PING':
            if (typeof msg[1] === 'undefined') {
                msg[1] = '';
            }
            gateway.notice(data.nick, String.fromCharCode(1) + 'PING ' + msg[1] + String.fromCharCode(1));
            break;
        case 'TIME':
            gateway.notice(data.nick, String.fromCharCode(1) + 'TIME ' + (new Date()).toLocaleString() + String.fromCharCode(1));
            break;
        }
        front.tabviews.server.addMsg(null, 'CTCP [' + data.nick + ']', data.msg, 'ctcp');
    },
    
    onCTCPResponse: function (e, data) {
    },

    onKiwi: function (e, data) {
        //console.log(data);
    },
    
    onConnect: function (e, data) {
        if (data.connected) {
            if (gateway.nick !== data.nick) {
                gateway.nick = data.nick;
                front.doLayout();
            }

            front.tabviews.server.addMsg(null, ' ', '=== Connected OK :)', 'status');
            if (typeof init_data.channel === "string") {
                front.joinChannel(init_data.channel);
            }
            plugs.run('connect', {success: true});
        } else {
            front.tabviews.server.addMsg(null, ' ', '=== Failed to connect :(', 'status');
            plugs.run('connect', {success: false});
        }
    },
    onConnectFail: function (e, data) {
        var reason = (typeof data.reason === 'string') ? data.reason : '';
        front.tabviews.server.addMsg(null, '', 'There\'s a problem connecting! (' + reason + ')', 'error');
        plugs.run('connect', {success: false});
    },
    onDisconnect: function (e, data) {
        var tab;
        for (tab in front.tabviews) {
            front.tabviews[tab].addMsg(null, '', 'Disconnected from server!', 'error');
        }
        plugs.run('disconnect', {success: false});
    },
    onOptions: function (e, data) {
        if (typeof gateway.network_name === "string" && gateway.network_name !== "") {
            front.tabviews.server.tab.text(gateway.network_name);
        }
    },
    onMOTD: function (e, data) {
        front.tabviews.server.addMsg(null, data.server, data.msg, 'motd');
    },
    onWhois: function (e, data) {
        var d;
        if (data.msg) {
            front.cur_channel.addMsg(null, data.nick, data.msg, 'whois');
        } else if (data.logon) {
            d = new Date();
            d.setTime(data.logon * 1000);
            d = d.toLocaleString();
            front.cur_channel.addMsg(null, data.nick, 'idle for ' + data.idle + ' second' + ((data.idle !== 1) ? 's' : '') + ', signed on ' + d, 'whois');
        } else {
            front.cur_channel.addMsg(null, data.nick, 'idle for ' + data.idle + ' seconds', 'whois');
        }
    },
    onMode: function (e, data) {
        console.log(data);
    },
    onUserList: function (e, data) {
        var ul, nick, mode;
        if (front.tabviews[data.channel.toLowerCase()] === undefined) {
            return;
        }
        ul = front.tabviews[data.channel.toLowerCase()].userlist;
        
        if (!document.userlist_updating) {
            document.userlist_updating = true;
            ul.empty();
        }
        
        $.each(data.users, function (i, item) {
            nick = i; //i.match(/^.+!/g);
            mode = item;
            $('<li><a class="nick" onclick="front.userClick(this);">' + mode + nick + '</a></li>').appendTo(ul);
        });
        
        front.tabviews[data.channel.toLowerCase()].userlistSort();
    },
    onUserListEnd: function (e, data) {
        document.userlist_updating = false;
    },
    
    onJoin: function (e, data) {
        if (!front.tabviewExists(data.channel)) {
            front.tabviewAdd(data.channel.toLowerCase());
        }
        
        if (data.nick === gateway.nick) {
            return; // Not needed as it's already in nicklist
        }
        front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '--> ' + data.nick + ' has joined', 'action', 'color:#009900;');
        $('<li><a class="nick" onclick="front.userClick(this);">' + data.nick + '</a></li>').appendTo(front.tabviews[data.channel.toLowerCase()].userlist);
        front.tabviews[data.channel.toLowerCase()].userlistSort();
    },
    onPart: function (e, data) {
        if (front.tabviewExists(data.channel)) {
            // If this is us, close the tabview
            if (data.nick === gateway.nick) {
                front.tabviews[data.channel.toLowerCase()].close();
                front.tabviews.server.show();
                return;
            }
            
            front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.nick + ' has left (' + data.message + ')', 'action', 'color:#990000;');
            front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
                if ($(this).text() === data.nick) {
                    $(this).remove();
                }
            });
        }
    },
    onKick: function (e, data) {
        if (front.tabviewExists(data.channel)) {
            // If this is us, close the tabview
            if (data.kicked === gateway.nick) {
                //front.tabviews[data.channel.toLowerCase()].close();
                front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '=== You have been kicked from ' + data.channel + '. ' + data.message, 'status');
                front.tabviews[data.channel.toLowerCase()].safe_to_close = true;
                $('li', front.tabviews[data.channel.toLowerCase()].userlist).remove();
                return;
            }
            
            front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.kicked + ' kicked by ' + data.nick + '(' + data.message + ')', 'action', 'color:#990000;');
            front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
                if ($(this).text() === data.nick) {
                    $(this).remove();
                }
            });
        }
    },
    onNick: function (e, data) {
        if (data.nick === gateway.nick) {
            gateway.nick = data.newnick;
            front.doLayout();
        }
        
        $.each(front.tabviews, function (i, item) {
            $.each(front.tabviews, function (i, item) {
                item.changeNick(data.newnick, data.nick);
            });
        });
    },
    onQuit: function (e, data) {
        $.each(front.tabviews, function (i, item) {
            $.each(front.tabviews, function (i, item) {
                item.userlist.children().each(function () {
                    if ($(this).text() === data.nick) {
                        $(this).remove();
                        item.addMsg(null, ' ', '<-- ' + data.nick + ' has quit (' + data.message + ')', 'action', 'color:#990000;');
                    }
                });
            });
        });
    },
    onChannelRedirect: function (e, data) {
        front.tabviews[data.from.toLowerCase()].close();
        front.tabviewAdd(data.to.toLowerCase());
        front.tabviews[data.to.toLowerCase()].addMsg(null, ' ', '=== Redirected from ' + data.from, 'action');
    },
    
    onIRCError: function (e, data) {
        var t_view;
        if (data.channel !== undefined && front.tabviewExists(data.channel)) {
            t_view = data.channel;
        } else {
            t_view = 'server';
        }

        switch (data.error) {
        case 'banned_from_channel':
            front.tabviews[t_view].addMsg(null, ' ', '=== You are banned from ' + data.channel + '. ' + data.reason, 'status');
            if (t_view !== 'server') {
                front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'bad_channel_key':
            front.tabviews[t_view].addMsg(null, ' ', '=== Bad channel key for ' + data.channel, 'status');
            if (t_view !== 'server') {
                front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'invite_only_channel':
            front.tabviews[t_view].addMsg(null, ' ', '=== ' + data.channel + ' is invite only.', 'status');
            if (t_view !== 'server') {
                front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'channel_is_full':
            front.tabviews[t_view].addMsg(null, ' ', '=== ' + data.channel + ' is full.', 'status');
            if (t_view !== 'server') {
                front.tabviews[t_view].safe_to_close = true;
            }
            break;
        case 'chanop_privs_needed':
            front.tabviews[data.channel].addMsg(null, ' ', '=== ' + data.reason, 'status');
            break;
        case 'no_such_nick':
            front.tabviews.server.addMsg(null, ' ', '=== ' + data.nick + ': ' + data.reason, 'status'); 
            break;
        case 'nickname_in_use':
            front.tabviews.server.addMsg(null, ' ', '=== The nickname ' + data.nick + ' is already in use. Please select a new nickname', 'status');
            front.showChangeNick();
            break;
        default:
            // We don't know what data contains, so don't do anything with it.
            //front.tabviews.server.addMsg(null, ' ', '=== ' + data, 'status');
        }
    },
    
    registerKeys: function () {
        $('#kiwi_msginput').bind('keydown', function (e) {
            var windows, meta, num, msg, data, candidates, word_pos, word, i;
            windows = $('#windows');
            //var meta = e.altKey;
            meta = e.ctrlKey;
            
            switch (true) {
            case (e.which >= 48) && (e.which <= 57):
                if (meta) {
                    num = e.which - 48;
                    if (num === 0) {
                        num = 10;
                    }
                    num = num - 1;
                    front.windowsShow(num);
                    return false;
                }
                break;
            case e.which === 27:            // escape                    
                return false;
            case e.which === 13:            // return
                msg = $('#kiwi_msginput').val();
                msg = msg.trim();
                
                front.buffer.push(msg);
                front.buffer_pos = front.buffer.length;
                
                front.run(msg);
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
                    front.windowsPrevious();
                    return false;
                }
                break;
            case e.which === 38:            // up
                if (front.buffer_pos > 0) {
                    front.buffer_pos--;
                    $('#kiwi_msginput').val(front.buffer[front.buffer_pos]);
                }
                break;
            case e.which === 39:            // right
                if (meta) {
                    front.windowsNext();
                    return false;
                }
                break;
            case e.which === 40:            // down
                if (front.buffer_pos < front.buffer.length) {
                    front.buffer_pos++;
                    $('#kiwi_msginput').val(front.buffer[front.buffer_pos]);
                }
                break;
                
            case e.which === 9:                // tab
                // Get possible autocompletions
                data = [];
                front.cur_channel.userlist.children().each(function () {
                    var nick;
                    nick = front.nickStripPrefix($('a.nick', this).text());
                    data.push(nick);
                });
                
                // Do the autocomplete
                if (this.value.length === this.selectionStart && this.value.length === this.selectionEnd) {
                    candidates = [];
                    
                    word_pos = this.value.lastIndexOf(' ');
                    word = "";
                    if (word_pos === -1) {
                        word = this.value;
                    } else {
                        word = this.value.substr(word_pos);
                    }
                    word = word.trim();
                    
                    // filter data to find only strings that start with existing value
                    for (i = 0; i < data.length; i++) {
                        if (data[i].indexOf(word) === 0 && data[i].length > word.length) {
                            candidates.push(data[i]);
                        }
                    }
                    
                    if (candidates.length > 0) {
                        // some candidates for autocompletion are found
                        this.value = this.value.substring(0, word_pos) + ' ' + candidates[0] + ': ';
                        this.selectionStart = this.value.length;
                    }
                }
                return false;
            }
        });
        
        
        $('#kiwi .control .msginput .nick').click(function () {
            front.showChangeNick();            
        });
        
        
        
        
        
        $('#kiwi .plugins .load_plugin_file').click(function () {
            if (typeof front.boxes.plugins !== "undefined") {
                return;
            }
            
            front.boxes.plugins = new Box("plugin_file");
            $('#tmpl_plugins').tmpl({}).appendTo(front.boxes.plugins.content);
            front.boxes.plugins.box.css('top', -(front.boxes.plugins.height + 40));
            
            // Populate the plugin list..
            function enumPlugins() {
                var lst, j, txt;
                lst = $('#plugin_list');
                lst.find('option').remove();
                for (j in plugs.loaded) {
                    txt = plugs.loaded[j].name;
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
                front.boxes.plugins.destroy();
            });
            
            $('#kiwi #plugins_list_unload').click(function () {
                var selected_plugin;
                selected_plugin = $('#plugin_list').val();
                plugs.unloadPlugin(selected_plugin);
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
            front.run('/NICK ' + $('#kiwi .txtnewnick').val());
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
        return (typeof front.tabviews[name.toLowerCase()] !== 'undefined');
    },
    
    tabviewAdd: function (v_name) {
        /*global Tabview */
        var re, htmlsafe_name, tmp_divname, tmp_userlistname, tmp_tabname, userlist_enabled = true;

        if (v_name.charAt(0) === gateway.channel_prefix) {
            re = new RegExp(gateway.channel_prefix, "g");
            htmlsafe_name = v_name.replace(re, 'pre');
            htmlsafe_name = "chan_" + htmlsafe_name;
        } else {
            htmlsafe_name = 'query_' + v_name;
            userlist_enabled = false;
        }
        
        tmp_divname = 'kiwi_window_' + htmlsafe_name;
        tmp_userlistname = 'kiwi_userlist_' + htmlsafe_name;
        tmp_tabname = 'kiwi_tab_' + htmlsafe_name;
        
        if (!front.tabviewExists(v_name)) {
            $('#kiwi .windows .scroller').append('<div id="' + tmp_divname + '" class="messages"></div>');
            $('#kiwi .userlist').append('<ul id="' + tmp_userlistname + '"></ul>');
            $('#kiwi .windowlist ul').append('<li id="' + tmp_tabname + '" onclick="front.tabviews[\'' + v_name.toLowerCase() + '\'].show();">' + v_name + '</li>');
        }
        //$('#kiwi .windowlist ul .window_'+v_name).click(function(){ front.windowShow(v_name); });
        //front.windowShow(v_name);
        
        front.tabviews[v_name.toLowerCase()] = new Tabview();
        front.tabviews[v_name.toLowerCase()].name = v_name;
        front.tabviews[v_name.toLowerCase()].div = $('#' + tmp_divname);
        front.tabviews[v_name.toLowerCase()].userlist = $('#' + tmp_userlistname);
        front.tabviews[v_name.toLowerCase()].tab = $('#' + tmp_tabname);
        if (!userlist_enabled) {
            front.tabviews[v_name.toLowerCase()].userlist_width = 0;
        }
        front.tabviews[v_name.toLowerCase()].show();
        
        if (typeof registerTouches === "function") {
            //alert("Registering touch interface");
            //registerTouches($('#'+tmp_divname));
            registerTouches(document.getElementById(tmp_divname));
        }
        /*
        front.tabviews[v_name.toLowerCase()].userlist.click(function(){
            alert($(this).attr('id'));
        });
        */

        front.doLayoutSize();
    },
    
    
    userClick: function (item) {
        var li = $(item).parent();

        // Remove any existing userboxes
        $('#kiwi .userbox').remove();

        if ($(li).data('userbox') === item) {
            $(li).removeData('userbox');
        } else {
            $('#tmpl_user_box').tmpl({nick: front.nickStripPrefix($(item).text())}).appendTo(li);
            
            $('#kiwi .userbox .userbox_query').click(function (ev) {
                var nick = $('#kiwi .userbox_nick').val();
                front.run('/query ' + nick);
            });
            
            $('#kiwi .userbox .userbox_whois').click(function (ev) {
                var nick = $('#kiwi .userbox_nick').val();
                front.run('/whois ' + nick);
            });
            $(li).data('userbox', item);
        }
    },
    
    
    sync: function () {
        gateway.sync();
    },
    
    onSync: function (e, data) {
        // Set any settings
        if (data.nick !== undefined) {
            gateway.nick = data.nick;
        }
        
        // Add the tabviews
        if (data.tabviews !== undefined) {
            $.each(data.tabviews, function (i, tab) {
                if (!front.tabviewExists(tab.name)) {
                    front.tabviewAdd(gateway.channel_prefix + tab.name);
                    
                    if (tab.userlist !== undefined) {
                        front.onUserList({'channel': gateway.channel_prefix + tab.name, 'users': tab.userlist});
                    }
                }
            });
        }
        
        front.doLayout();
    },
    
    
    setTopicText: function (new_topic) {
        front.original_topic = new_topic;
        $('#kiwi .cur_topic .topic').text(new_topic);
        front.doLayoutSize();
    },
    
    
    
    
    
    
    
    nickStripPrefix: function (nick) {
        var tmp = nick, i, prefix;
        
        prefix = tmp.charAt(0);
        for (i in gateway.user_prefixes) {
            if (gateway.user_prefixes[i].symbol === prefix) {
                return tmp.substring(1);
            }
        }

        return tmp;
    },
    
    nickGetPrefix: function (nick) {
        var tmp = nick, i, prefix;
        
        prefix = tmp.charAt(0);
        for (i in gateway.user_prefixes) {
            if (gateway.user_prefixes[i].symbol === prefix) {
                return prefix;
            }
        }

        return '';
    },
    
    isChannel: function (name) {
        var prefix, is_chan;
        prefix = name.charAt(0);
        if (gateway.channel_prefix.indexOf(prefix) > -1) {
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
        for (tab in front.tabviews) {
            if (!next) {
                if (front.tabviews[tab] === front.cur_channel) {
                    next = true;
                    continue;
                }
            } else {
                front.tabviews[tab].show();
                return;
            }
        }
    },

    windowsPrevious: function () {
        var tab, prev_tab, next;
        next = false;
        for (tab in front.tabviews) {
            if (front.tabviews[tab] === front.cur_channel) {
                if (prev_tab) {
                    prev_tab.show();
                }
                return;
            }
            prev_tab = front.tabviews[tab];
        }
    },

    windowsShow: function (num) {
        num = parseInt(num, 10);
        console.log('Showing window ' + num.toString());
        var i = 0, tab;
        for (tab in front.tabviews) {
            if (i === num) {
                front.tabviews[tab].show();
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

    $('#kiwi .windows .scroller').append('<div id="' + tmp_divname + '" class="messages"></div>');

    this.tab = $('<li id="' + tmp_tabname + '">' + this.title + '</li>');
    this.tab.click(function () {
        front.utilityviews[rand_name.toLowerCase()].show();
    });
    $('#kiwi .utilityviewlist ul').append(this.tab);
    
    this.div = $('#' + tmp_divname);
    this.div.css('overflow', 'hidden');

    front.utilityviews[rand_name.toLowerCase()] = this;
};

Utilityview.prototype.name = null;
Utilityview.prototype.title = null;
Utilityview.prototype.div = null;
Utilityview.prototype.tab = null;
Utilityview.prototype.topic = ' ';
Utilityview.prototype.show = function () {
    $('#kiwi .messages').removeClass("active");
    $('#kiwi .userlist ul').removeClass("active");
    $('#kiwi .toolbars ul li').removeClass("active");

    $('#windows').css('overflow-y', 'hidden');
    $('#windows').css('right', 0);
    // Activate this tab!
    this.div.addClass('active');
    this.tab.addClass('active');

    this.addPartImage();

    front.setTopicText(this.topic);
    front.cur_channel = this;

    // If we're using fancy scrolling, refresh it
    if (touch_scroll) {
        touch_scroll.refresh();
    }
};

Utilityview.prototype.close = function () {
    this.div.remove();
    this.tab.remove();
    
    if (front.cur_channel === this) {
        front.tabviews.server.show();
    }
    delete front.utilityviews[this.name.toLowerCase()];
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
        if (front.cur_channel.name !== 'server') {
            front.cur_channel.close();
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


var Tabview = function () {};
Tabview.prototype.name = null;
Tabview.prototype.div = null;
Tabview.prototype.userlist = null;
Tabview.prototype.userlist_width = 100;     // 0 for disabled
Tabview.prototype.tab = null;
Tabview.prototype.topic = "";
Tabview.prototype.safe_to_close = false;                // If we have been kicked/banned/etc from this channel, don't wait for a part message

Tabview.prototype.show = function () {
    var w, u;

    $('#kiwi .messages').removeClass("active");
    $('#kiwi .userlist ul').removeClass("active");
    $('#kiwi .toolbars ul li').removeClass("active");
    
    w = $('#windows');
    u = $('#kiwi .userlist');

    w.css('overflow-y', 'scroll');

    // Set the window size accordingly
    if (this.userlist_width > 0) {
        u.width(this.userlist_width);
        w.css('right', u.outerWidth(true));
    } else {
        w.css('right', 0);
    }

    // Activate this tab!
    this.div.addClass('active');
    if (this.userlist_width > 0) {
        this.userlist.addClass('active');
    }
    this.tab.addClass('active');
    
    // Add the part image to the tab
    this.addPartImage();
    
    this.clearHighlight();
    front.setTopicText(this.topic);
    front.cur_channel = this;
    
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
    
    if (front.cur_channel === this) {
        front.tabviews.server.show();
    }
    delete front.tabviews[this.name.toLowerCase()];
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
        if (front.isChannel($(this).parent().text())) {
            front.run("/part");
        } else {
            // Make sure we don't close the server tab
            if (front.cur_channel.name !== 'server') {
                front.cur_channel.close();
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
    tmp = plugs.run('addmsg', tmp);
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
    
    // Text formatting
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
    
    // Wierd thing noticed by Dux0r on the irc.esper.net server
    if (typeof msg !== "string") {
        msg = '';
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
    
    // Make the channels clickable
    re = new RegExp('\\B(' + gateway.channel_prefix + '[^ ,.\\007]+)', 'g');
    msg = msg.replace(re, function (match) {
        return '<a class="chan">' + match + '</a>';
    });

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
    var w = $('#windows');
    w[0].scrollTop = w[0].scrollHeight;
};

Tabview.prototype.changeNick = function (newNick, oldNick) {
    this.userlist.children().each(function () {
        var item = $('a.nick', this);
        if (front.nickStripPrefix(item.text()) === oldNick) {
            item.text(front.nickGetPrefix(item.text()) + newNick);
            document.temp_chan = 1;
        }
    });
    
    if (typeof document.temp_chan !== "undefined") {
        this.addMsg(null, ' ', '=== ' + oldNick + ' is now known as ' + newNick, 'action');
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
        for (i in gateway.user_prefixes) {
            prefix = gateway.user_prefixes[i].symbol;
            
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
    if (front.cur_channel.name === this.name) {
        front.setTopicText(new_topic);
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
    for (name in front.boxes) {
        if (front.boxes[name].id === this.id) {
            delete front.boxes[name];
        }
    }
};
Box.prototype.height = function () { 
    return this.box.height();
};

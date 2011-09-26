/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi, _, io, $, iScroll, agent, touchscreen, init_data, plugs, plugins, registerTouches, randomString */
kiwi.front = {
    cur_channel: '',
    windows: {},
    tabviews: {},
    utilityviews: {},
    boxes: {},

    buffer: [],         // Command history
    buffer_pos: 0,      // Current command history position

    // Container for misc data (eg. userlist generation)
    cache: {original_topic: '', userlist: {}},

    init: function () {
        /*global Box, touch_scroll:true, Tabview */
        var about_info, supportsOrientationChange, orientationEvent, scroll_opts, server_tabview;
        kiwi.gateway.nick = 'kiwi_' + Math.ceil(100 * Math.random()) + Math.ceil(100 * Math.random());
        kiwi.gateway.session_id = null;

        // Bind to the gateway events
        kiwi.front.events.bindAll();

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

        kiwi.front.ui.registerKeys();

        window.onbeforeunload = function() {
            return "Are you sure you leave Kiwi IRC?";
        };

        $('#kiwi .toolbars').resize(kiwi.front.ui.doLayoutSize);
        $(window).resize(kiwi.front.ui.doLayoutSize);

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

            kiwi.front.ui.doLayout();
            try {
                kiwi.front.run('/connect ' + netsel.val() + ' ' + netport.val() + ' ' + (netssl.attr('checked') ? 'true' : ''));
            } catch (e) {
                console.log(e);
            }

            $('#kiwi .connectwindow').slideUp('', kiwi.front.ui.barsShow);
            $('#windows').click(function () { $('#kiwi_msginput').focus(); });

            return false;
        });

        supportsOrientationChange = (typeof window.onorientationchange !==  undefined);
        orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";
        if (window.addEventListener) {
            window.addEventListener(orientationEvent, kiwi.front.ui.doLayoutSize, false);
        } else {
            // < IE9
            window.attachEvent(orientationEvent, kiwi.front.ui.doLayoutSize, false);
        }
        //$('#kiwi').bind("resize", kiwi.front.ui.doLayoutSize, false);

        kiwi.front.ui.doLayout();
        kiwi.front.ui.barsHide();

        server_tabview = new Tabview('server');
        server_tabview.userlist.setWidth(0); // Disable the userlist
        server_tabview.setIcon('/img/app_menu.png');
        console.log($('.icon', server_tabview.tab));
        $('.icon', server_tabview.tab).tipTip({
            delay: 0,
            keepAlive: true,
            content: $('#tmpl_network_menu').tmpl({}).html(),
            activation: 'click'
        });

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
                $(this).text(kiwi.front.cache.original_topic);
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
                $(this).text(kiwi.front.cache.original_topic);
            }
        });*/
        $('.cur_topic').live('change', function () {
            var chan, text;
            text = $(this).text();
            if (text !== kiwi.front.cache.original_topic) {
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
        var parts, dest, t, pos, textRange, plugin_event, msg_sliced, tab;

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
                    kiwi.front.ui.showChangeNick();
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
                kiwi.front.events.onNotice({}, {nick: kiwi.gateway.nick, channel: dest, msg: msg});
                break;

            case '/win':
                if (parts[1] !== undefined) {
                    kiwi.front.ui.windowsShow(parseInt(parts[1], 10));
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
                break;
            }

        } else {
            //alert('Sending message: '+msg);
            if (msg.trim() === '') {
                return;
            }
            if (Tabview.getCurrentTab().name !== 'server') {
                kiwi.gateway.msg(Tabview.getCurrentTab().name, msg);
                Tabview.getCurrentTab().addMsg(null, kiwi.gateway.nick, msg);
            }
        }
    },







    sync: function () {
        kiwi.gateway.sync();
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

    formatIRCMsg: function (msg) {
        var re, next;

        if ((!msg) || (typeof msg !== 'string')) {
            return '';
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
    /*globals User */
    var userlist, list_html, sortUsers;

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

        userlist.sort(User.compare);

        _.each(userlist, function (user) {
            user.html = user.html.appendTo(list_html);
        });

        list_html = list_html.appendTo(parent);
    };

    this.addUser = function (users) {
        if (!_.isArray(users)) {
            users = [users];
        }
        _.each(users, function (user) {
            user = new User(user.nick, user.modes);
            user.html = $('<li><a class="nick">' + user.prefix + user.nick + '</a></li>');
            user.html.data('user', user);
            userlist.push(user);
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
            user.html.text(User.getPrefix(user.modes) + newNick);
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

    this.getUser = function (nick) {
        if (this.hasUser(nick)) {
            return _.detect(userlist, function (user) {
                return user.nick === nick;
            });
        } else {
            return null;
        }
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
        var user, prefix;
        if (this.hasUser(nick)) {
            user = _.detect(userlist, function (u) {
                return u.nick === nick;
            });

            prefix = user.prefix;
            if ((arguments.length < 3) || (add)) {
                user.addMode(mode);
            } else {
                user.removeMode(mode);
            }
            if (prefix !== user.prefix) {
                user.html.children('a:first').text(user.prefix + user.nick);
            }
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
    var li = $(this).parent(),
        user = li.data('user');

    // Remove any existing userboxes
    $('#kiwi .userbox').remove();

    if ($(li).data('userbox') === this) {
        $(li).removeData('userbox');
    } else {
        $('#tmpl_user_box').tmpl({nick: user.nick}).appendTo(li);

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




var User = function (nick, modes) {
    var sortModes;

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

    this.nick = User.stripPrefix(nick);
    this.modes = modes || [];
    this.modes = sortModes(this.modes);
    this.prefix = User.getPrefix(this.modes);

    this.addMode = function (mode) {
        this.modes.push(mode);
        this.modes = sortModes(this.modes);
        this.prefix = User.getPrefix(this.modes);
        return this;
    };
};

User.prototype.removeMode = function (mode) {
    this.modes = _.reject(this.modes, function (m) {
        return m === mode;
    });
    this.prefix = User.getPrefix(this.modes);
    return this;
};

User.prototype.isOp = function () {
    // return true if this.mode[0] > o
    return false;
};

User.getPrefix = function (modes) {
    var prefix = '';
    if (typeof modes[0] !== 'undefined') {
        prefix = _.detect(kiwi.gateway.user_prefixes, function (prefix) {
            return prefix.mode === modes[0];
        });
        prefix = (prefix) ? prefix.symbol : '';
    }
    return prefix;
};

User.stripPrefix = function (nick) {
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
};

User.compare = function (a, b) {
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
    kiwi.front.ui.doLayoutSize();

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

    kiwi.front.ui.setTopicText(this.topic);
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
    var re, htmlsafe_name, tmp_divname, tmp_userlistname, tmp_tabname, tmp_tab, userlist_enabled = true;

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
        tmp_tab = $('<li id="' + tmp_tabname + '"><span>' + v_name + '</span></li>');
        $('#kiwi .windowlist ul').append(tmp_tab);
        tmp_tab.click(function (e) {
            var tab = Tabview.getTab(v_name);
            if (tab) {
                tab.show();
            }
        });
    }

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

    kiwi.front.ui.doLayoutSize();
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
    kiwi.front.ui.setTopicText(this.topic);
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

Tabview.prototype.setIcon = function (url) {
    this.tab.prepend('<img src="' + url + '" class="icon" />');
    this.tab.css('padding-left', '33px');
};

Tabview.prototype.setTabText = function (text) {
    $('span', this.tab).text(text);
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
        kiwi.front.ui.setTopicText(new_topic);
    }
};
// Static functions
Tabview.tabExists = function (name) {
    if ((!name) || (typeof name !== 'string')) {
        return false;
    }
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

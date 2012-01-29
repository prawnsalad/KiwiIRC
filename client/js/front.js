/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi, _, io, $, iScroll, agent, touchscreen, init_data, plugs, plugins, registerTouches, randomString */
/**
*   @namespace
*/
kiwi.front = {
    /**
    *   The current channel
    *   @type Object
    */
    cur_channel: null,
    /**
    *   A list of windows
    *   @type Object
    */
    windows: {},
    /**
    *   A list of Tabviews
    *   @type Object
    */
    tabviews: {},
    /**
    *   A list of Utilityviews
    *   @type Object
    */
    utilityviews: {},
    /**
    *   A list of Boxes
    *   @type Object
    */
    boxes: {},

    /**
    *   The command history
    *   @type Array
    */
    buffer: [],
    /**
    *   The current command history position
    *   @type Number
    */
    buffer_pos: 0,

    /**
    *   Container for misc data (eg. userlist generation)
    *   @type Object
    */
    cache: {original_topic: '', userlist: {}},

    /**
    *   Initialisation function
    */
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

        $('#kiwi .toolbars').resize(kiwi.front.ui.doLayoutSize);
        $(window).resize(kiwi.front.ui.doLayoutSize);

        // Add the resizer for the userlist
        $('<div id="nicklist_resize"></div>').appendTo('#kiwi');
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
                netpass = $('#kiwi .formconnectwindow .password'),
                nick = $('#kiwi .formconnectwindow .nick'),
                tmp,
                forwardKeys;

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
                tmp = '/connect ' + netsel.val() + ' ' + netport.val() + ' ';
                tmp += (netssl.is(':checked') ? 'true' : 'false') + ' ' + netpass.val();
                kiwi.front.run(tmp);
            } catch (e) {
                console.log(e);
            }

            $('#kiwi .connectwindow').slideUp('', kiwi.front.ui.barsShow);
            
            /**
            *   Listen for keyboard activity on any window, and forward it to the
            *   input box so users can type even if the input box is not in focus
            *   @inner
            *   @param  {eventObject}   event   The event to forward
            */
            forwardKeys = function (event) {
                $('#kiwi_msginput').focus();
                $('#kiwi_msginput').trigger(event);
            };
            $('#kiwi_msginput').attr('tabindex', 0);
            $('#kiwi_msginput').focus();
            $('#windows').attr('tabindex',100);
            $('#windows').keydown(forwardKeys).keypress(forwardKeys).keyup(forwardKeys);

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

        kiwi.bbchans = new kiwi.model.ChannelList();
        kiwi.bbtabs = new kiwi.view.Tabs({"el": $('#kiwi .windowlist ul')[0], "model": kiwi.bbchans});
        
        
        //server_tabview = new Tabview('server');
        //server_tabview.userlist.setWidth(0); // Disable the userlist
        //server_tabview.setIcon('/img/app_menu.png');
        //$('.icon', server_tabview.tab).tipTip({
        //    delay: 0,
        //    keepAlive: true,
        //    content: $('#tmpl_network_menu').tmpl({}).html(),
        //    activation: 'click'
        //});

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
                //chan = Tabview.getCurrentTab().name;
                //kiwi.gateway.topic(chan, text);
            }
        });


        $('#windows a.chan').live('click', function () {
            kiwi.front.joinChannel($(this).text());
            return false;
        });

        kiwi.data.set('chanList', []);

        // Load any client plugins
        (function () {
            var i;
            for (i in plugins) {
                kiwi.plugs.loadPlugin(plugins[i]);
            }
        }());
    },



    /**
    *   Joins a channel
    *   @param  {String}    chan_name   The name of the channel to join
    */
    joinChannel: function (chan_name) {
        var chans = chan_name.split(','),
            i,
            chan,
            tab;
        for (i in chans) {
            chan = chans[i];
            //tab = Tabview.getTab(chan);
            //if ((!tab) || (tab.safe_to_close === true)) {
                kiwi.gateway.join(chan);
                //tab = new Tabview(chan);
            //} else {
            //    tab.show();
            //}
        }
    },

    /**
    *   Parses and executes text and commands entered into the input msg box
    *   @param  {String}    msg The message string to parse
    */
    run: function (msg) {
        var parts, dest, t, pos, textRange, plugin_event, msg_sliced, tab, nick;

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
                    alert('Usage: /connect servername [port] [ssl] [password]');
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

                //Tabview.getCurrentTab().addMsg(null, ' ', '=== Connecting to ' + parts[1] + ' on port ' + parts[2] + (parts[3] ? ' using SSL' : '') + '...', 'status');
                console.log('Connecting to ' + parts[1] + ' on port ' + parts[2] + (parts[3] ? ' using SSL' : '') + '...');
                kiwi.gateway.connect(parts[1], parts[2], parts[3], parts[4]);
                break;

            case '/nick':
                console.log("/nick");
                if (parts[1] === undefined) {
                    console.log("calling show nick");
                    kiwi.front.ui.showChangeNick();
                } else {
                    console.log("sending nick");
                    kiwi.gateway.changeNick(parts[1]);
                }
                break;

            case '/part':
                if (typeof parts[1] === "undefined") {
                    //if (Tabview.getCurrentTab().safe_to_close) {
                    //    Tabview.getCurrentTab().close();
                    //} else {
                    //    kiwi.gateway.part(Tabview.getCurrentTab().name);
                    //}
                } else {
                    kiwi.gateway.part(msg.substring(6));
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
                    //tab = new Tabview(parts[1]);
                }
                break;


            case '/m':
            case '/msg':
                if (typeof parts[1] !== "undefined") {
                    msg_sliced = msg.split(' ').slice(2).join(' ');
                    kiwi.gateway.privmsg(parts[1], msg_sliced);

                    //tab = Tabview.getTab(parts[1]);
                    //if (!tab) {
                    //    tab = new Tabview(parts[1]);
                    //}
                    //tab.addMsg(null, kiwi.gateway.nick, msg_sliced);
                }
                break;

            case '/k':
            case '/kick':
                if (typeof parts[1] === 'undefined') {
                    return;
                }
                t = msg.split(' ', 3);
                nick = t[1];
                //kiwi.gateway.kick(Tabview.getCurrentTab().name, nick, t[2]);
                break;

            case '/quote':
                kiwi.gateway.raw(msg.replace(/^\/quote /i, ''));
                break;

            case '/me':
                //tab = Tabview.getCurrentTab();
                //kiwi.gateway.ctcp(true, 'ACTION', tab.name, msg.substring(4));
                //tab.addMsg(null, ' ', '* ' + kiwi.gateway.nick + ' ' + msg.substring(4), 'action', 'color:#555;');
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
                    //kiwi.gateway.topic(Tabview.getCurrentTab().name, msg.split(' ', 2)[1]);
                }
                break;

            case '/kiwi':
                //kiwi.gateway.ctcp(true, 'KIWI', Tabview.getCurrentTab().name, msg.substring(6));
                break;

            case '/ctcp':
                parts = parts.slice(1);
                dest = parts.shift();
                t = parts.shift();
                msg = parts.join(' ');
                console.log(parts);
                
                kiwi.gateway.ctcp(true, t, dest, msg);
                //Tabview.getServerTab().addMsg(null, 'CTCP Request', '[to ' + dest + '] ' + t + ' ' + msg, 'ctcp');
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
            //if (Tabview.getCurrentTab().name !== 'server') {
            //    kiwi.gateway.privmsg(Tabview.getCurrentTab().name, msg);
            //    Tabview.getCurrentTab().addMsg(null, kiwi.gateway.nick, msg);
            //}
        }
    },





    /**
     *  Sort the window list
     */
    sortWindowList: function () {
        var win_list = $('#kiwi .windowlist ul'),
            listitems = win_list.children('li').get();
        
        /*listitems.sort(function (a, b) {
            if (a === Tabview.getServerTab().tab[0]) {
                return -1;
            }
            if (b === Tabview.getServerTab().tab[0]) {
                return 1;
            }
            var compA = $(a).text().toUpperCase(),
                compB = $(b).text().toUpperCase();
            return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
        });

        $.each(listitems, function(idx, itm) {
            win_list.append(itm);
        });*/
    },




    /**
    *   Syncs with the Kiwi server
    *   Not implemented
    */
    sync: function () {
        kiwi.gateway.sync();
    },

    /**
    *   Checks if a given name is the name of a channel
    *   @param      {String}    name    The name to check
    *   @returns    {Boolean}           True if name is the name of a channel, false if it is not
    */
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

    /**
    *   Formats a message. Adds bold, underline and colouring
    *   @param      {String}    msg The message to format
    *   @returns    {String}        The HTML formatted message
    */
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
        /**
        *   @inner
        */
        msg = (function (msg) {
            var replace, colourMatch, col, i, match, to, endCol, fg, bg, str;
            replace = '';
            /**
            *   @inner
            */
            colourMatch = function (str) {
                var re = /^\x03([0-9][0-5]?)(,([0-9][0-5]?))?/;
                return re.exec(str);
            };
            /**
            *   @inner
            */
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
            if (msg.indexOf('\x03') !== -1) {
                i = msg.indexOf('\x03');
                replace = msg.substr(0, i);
                while (i < msg.length) {
                    /**
                    *   @inner
                    */
                    match = colourMatch(msg.substr(i, 6));
                    if (match) {
                        //console.log(match);
                        // Next colour code
                        to = msg.indexOf('\x03', i + 1);
                        endCol = msg.indexOf(String.fromCharCode(15), i + 1);
                        if (endCol !== -1) {
                            if (to === -1) {
                                to = endCol;
                            } else {
                                to = ((to < endCol) ? to : endCol);
                            }
                        }
                        if (to === -1) {
                            to = msg.length;
                        }
                        //console.log(i, to);
                        fg = col(match[1]);
                        bg = col(match[3]);
                        str = msg.substring(i + 1 + match[1].length + ((bg !== null) ? match[2].length + 1 : 0), to);
                        //console.log(str);
                        replace += '<span style="' + ((fg !== null) ? 'color: ' + fg + '; ' : '') + ((bg !== null) ? 'background-color: ' + bg + ';' : '') + '">' + str + '</span>';
                        i = to;
                    } else {
                        if ((msg[i] !== '\x03') && (msg[i] !== String.fromCharCode(15))) {
                            replace += msg[i];
                        }
                        i++;
                    }
                }
                return replace;
            }
            return msg;
        }(msg));
        
        return msg;
    },

    /**
    *   Registers Kiwi IRC as a handler for the irc:// protocol in the browser
    */
    registerProtocolHandler: function () {
        var state, uri;
        url = kiwi_server.replace(/\/kiwi$/, '/?ircuri=%s');
        try {
            //state = window.navigator.isProtocolHandlerRegistered('irc', url);
            //if (state !== 'registered') {
                window.navigator.registerProtocolHandler('irc', url, 'Kiwi IRC');
            //}
        } catch (e) {
            console.log('Unable to register Kiwi IRC as a handler for irc:// links');
            console.error(e);
        }
    }

};





/**
*   @constructor
*/
var ChannelList = function () {
    /*globals Utilityview */
    var chanList, view, table, obj, renderTable, waiting;
    chanList = [];

    view = new Utilityview('Channel List');
    view.div.css('overflow-y', 'scroll');

    table = $('<table style="margin:1em 2em;"><thead style="font-weight: bold;"><tr><td>Channel Name</td><td>Members</td><td style="padding-left: 2em;">Topic</td></tr></thead><tbody style="vertical-align: top;"></tbody>');
    table = table.appendTo(view.div);

    waiting = false;
    /**
    *   @inner
    */
    renderTable = function () {
        var tbody;
        tbody = table.children('tbody:first').detach();
        /*tbody.children().each(function (child) {
            var i, chan;
            child = $(child);
            chan = child.children('td:first').text();
            for (i = 0; i < chanList.length; i++) {
                if (chanList[i].channel === chan) {
                    chanList[i].html = child.detach();
                    break;
                }
            }
        });*/
        _.each(chanList, function (chan) {
            chan.html = $(chan.html).appendTo(tbody);
        });
        table = table.append(tbody);
        waiting = false;
    };
    /**
    *   @lends ChannelList
    */
    return {
        /**
        *   Adds a channel or channels to the list
        *   @param  {Object}    channels    The channel or Array of channels to add
        */
        addChannel: function (channels) {
            if (!_.isArray(channels)) {
                channels = [channels];
            }
            _.each(channels, function (chan) {
                var html, channel;
                html = $('<tr><td><a class="chan">' + chan.channel + '</a></td><td class="num_users" style="text-align: center;">' + chan.num_users + '</td><td style="padding-left: 2em;">' + kiwi.front.formatIRCMsg(chan.topic) + '</td></tr>');
                chan.html = html;
                chanList.push(chan);
            });
            chanList.sort(function (a, b) {
                return b.num_users - a.num_users;
            });
            if (!waiting) {
                waiting = true;
                _.defer(renderTable);
            }
        },
        /**
        *   Show the {@link UtilityView} that will display this channel list
        */
        show: function () {
            view.show();
        },
        /**
        *   @private
        */
        prototype: {constructor: this}
    };
};

/*
 *   MISC VIEW
 */
/**
*   @constructor
*   A tab to show non-channel and non-query windows to the user
*   @param  {String}    name    The name of the view
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
/**
*   Brings this view to the foreground
*/
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
/**
*   Sets a new panel to be this view's parent
*   @param  {JQuery}    new_panel   The new parent
*/
Utilityview.prototype.setPanel = function (new_panel) {
    this.div.detach();
    this.panel = new_panel;
    this.panel.append(this.div);
    this.show();
};
/**
*   Removes the panel from the UI and destroys its contents
*/
Utilityview.prototype.close = function () {
    this.div.remove();
    this.tab.remove();

    if (Tabview.getCurrentTab() === this) {
        kiwi.front.tabviews.server.show();
    }
    delete kiwi.front.utilityviews[this.name.toLowerCase()];
};
/**
*   Adds the close image to the tab
*/
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
/**
*   Removes the close image from the tab
*/
Utilityview.prototype.clearPartImage = function () {
    $('#kiwi .toolbars .tab_part').remove();
};

/**
*   @constructor
*   Floating message box
*   @param      {String}    classname   The CSS classname to apply to the box
*/
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

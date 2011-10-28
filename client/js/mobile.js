if (typeof String.prototype.lpad === 'undefined') {
    String.prototype.lpad = function (length, character) {
        var padding = "",
            i;
        for (i = 0; i < length; i++) {
            padding += character;
        }
        return (padding + this).slice(-length);
    };
}


var kiwi = {};
kiwi.objects = {};
kiwi.ui = {};
kiwi.events = {};
kiwi.gateway = {};


/**
 * Any user interface methods
 */
kiwi.ui = {
    views: {},
    current_view: null,

    doLayout: function () {
        var msgs = $('#msgs');
        msgs.css('padding-top', $('#hover_top').outerHeight());
        msgs.css('padding-bottom', $('#hover_bottom').outerHeight());
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


    run: function (msg) {
        var parts, dest, t, pos, textRange, plugin_event, msg_sliced, tab, nick;

        if (msg.substring(0, 1) === '/') {
            console.log("running " + msg);
            parts = msg.split(' ');
            switch (parts[0].toLowerCase()) {
            case '/nick':
                if (parts[1] === undefined) {
                    console.log("calling show nick");
                    kiwi.front.ui.showChangeNick();
                } else {
                    console.log("sending nick");
                    kiwi.gateway.nick(msg.substring(1));
                }
                break;
                
            case '/q':
            case '/query':
                if (typeof parts[1] !== "undefined") {
                    tab = new kiwi.objects.MessageView(parts[1]);
                }
                break;
                
            case '/k':
            case '/kick':
                if (typeof parts[1] === 'undefined') {
                    return;
                }
                t = msg.split(' ', 3);
                nick = t[1];
                kiwi.gateway.kick(Tabview.getCurrent().title, nick, t[2]);
                break;
                
            case '/j':
            case '/join':
                kiwi.ui.joinChannel(parts[1]);
                break;

            case '/part':
                break;

            case '/quote':
                kiwi.gateway.raw(msg.replace(/^\/quote /i, ''));
                break;
                
            case '/me':
                tab = kiwi.objects.getCurrent();
                kiwi.gateway.ctcp(true, 'ACTION', tab.title, msg.substring(4));
                tab.addMsg(' ', '* ' + kiwi.gateway.nick + ' ' + msg.substring(4));
                break;

            case '/quit':
                kiwi.gateway.quit(parts.slice(1).join(' '));
                break;
            }

        } else {
            if (msg.trim() === '') {
                return;
            }
            tab = kiwi.objects.MessageView.getCurrent();
            if (tab.title !== 'server') {
                console.log(tab.title);
                kiwi.gateway.privmsg(tab.title, msg);
                tab.addMsg(kiwi.gateway.nick, msg);
            }
        }

    },

    joinChannel: function (chan_name) {
        var chans = chan_name.split(','),
            i,
            chan,
            tab;
        for (i in chans) {
            chan = chans[i];
            tab = kiwi.objects.MessageView.get(chan);
            if ((!tab) || (tab.safe_to_close === true)) {
                kiwi.gateway.join(chan);
                tab = new kiwi.objects.MessageView(chan);
            }
        }

        if (tab) {
            tab.show();
        }
    },
};


/**
 * Entry point for Kiwi
 */
kiwi.init = function () {
    var server,
        gateway = $(kiwi.gateway);
    
    server = new kiwi.objects.MessageView('server');
    server.show();
    server.addMsg('', 'KiwiIRC Mobile client');
    console.log = function (w) {
        server.addMsg('log', w);
    }

    kiwi.ui.doLayout();

    $('#msginp').bind('keydown', function (e) {
        switch (true) {
            case e.which === 13:            // return
                msg = $(this).val();
                msg = msg.trim();

                kiwi.ui.run(msg);
                $(this).val('');

                break;
        }
    });

    gateway.bind('onconnect', function (e, data) {
        kiwi.objects.MessageView.getServer().addMsg('', 'Connected :)');
    });
    gateway.bind('onmotd', function (e, data) {
        kiwi.objects.MessageView.getServer().addMsg('', data.msg);
    });
    gateway.bind('onmsg', function (e, data) {
        var destination, plugin_event, tab;
        // Is this message from a user?
        if (data.channel === kiwi.gateway.nick) {
            destination = data.nick.toLowerCase();
        } else {
            destination = data.channel.toLowerCase();
        }
        
        tab = kiwi.objects.MessageView.get(destination);
        if (!tab) {
            tab = new kiwi.objects.MessageView(destination);
        }
        tab.addMsg(data.nick, data.msg);
    });
    gateway.bind('onjoin', function (e, data) {
        var tab = kiwi.objects.MessageView.get(data.channel);
        if (!tab) {
            tab = new kiwi.objects.MessageView(data.channel);
        }
        tab.addMsg('', '--> ' + data.nick + ' has joined', 'join');
    });
    gateway.bind('onpart', function (e, data) {
        var tab = kiwi.objects.MessageView.get(data.channel);
        if (!tab) {
            tab = new kiwi.objects.MessageView(data.channel);
        }
        tab.addMsg('', '<-- ' + data.nick + ' has left (' + data.message + ')', 'part');
    });
};








/**
 * Basic container that holds content on the page
 */
kiwi.objects.View = function (title) {
    var that = this;

    this.title = title;
    this.tab = $('<li>' + title + '</li>');
    this.content = $('<div></div>');

    $('#chan_list').append(this.tab);
    $('#msgs').append(this.content);

    this.tab.click(function () { that.show.call(that); });
};
kiwi.objects.View.prototype.title = 'View';
kiwi.objects.View.prototype.tab = null;
kiwi.objects.View.prototype.content = null;
kiwi.objects.View.prototype.show = function () {
    $('#msgs > div.active').removeClass('active');
    this.content.addClass('active');
    kiwi.ui.current_view = this;
    this.scrollBottom();
}
kiwi.objects.View.prototype.scrollBottom = function () {
    $(window).scrollTop($(document).height());
}




/**
 * A type of View that contains mainly messages
 */
kiwi.objects.MessageView = function (name) {
    // Call the parent constructor
    kiwi.objects.View.prototype.constructor.call(this, name);

    // Add this MessageView to the array
    kiwi.ui.views[name.toLowerCase()] = this;
}
kiwi.objects.MessageView.prototype = new kiwi.objects.View();
kiwi.objects.MessageView.prototype.msg_count = 0;
kiwi.objects.MessageView.prototype.addMsg = function (nick, text, msg_class) {
    var msg, d = new Date(),
        time;
    
    // The CSS class to use
    msg_class = msg_class || '';

    msg = $('<div class="msg ' + msg_class + '"><span class="time"></span><span class="nick"></span><span class="body"></span></div>');
    time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");

    $('.time', msg).text(time);
    $('.nick', msg).text(nick);
    $('.body', msg).text(kiwi.ui.formatIRCMsg(text));
    this.content.append(msg);

    this.msg_count++;
    if (this.msg_count > 5) {
        $('.msg:first', this.content).remove();
        this.msg_count--;
    }

    this.scrollBottom();
}
// Static functions
kiwi.objects.MessageView.exists = function (name) {
    if ((!name) || (typeof name !== 'string')) {
        return false;
    }
    var ret = (typeof kiwi.ui.views[name.toLowerCase()] !== 'undefined');
    return ret;
};
kiwi.objects.MessageView.get = function (name) {
    if (kiwi.objects.MessageView.exists(name)) {
        var ret = kiwi.ui.views[name.toLowerCase()];
        return ret;
    } else {
        return null;
    }
};
kiwi.objects.MessageView.getServer = function () {
    return kiwi.ui.views.server;
};
kiwi.objects.MessageView.getAlls = function () {
    return kiwi.ui.views;
};
kiwi.objects.MessageView.getCurrent = function () {
    return kiwi.ui.current_view;
};
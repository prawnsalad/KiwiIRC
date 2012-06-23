/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */
kiwi.model = {};



kiwi.model.MemberList = Backbone.Collection.extend({
    model: kiwi.model.Member,
    comparator: function (a, b) {
        var i, a_modes, b_modes, a_idx, b_idx, a_nick, b_nick;
        a_modes = a.get("modes");
        b_modes = b.get("modes");
        // Try to sort by modes first
        if (a_modes.length > 0) {
            // a has modes, but b doesn't so a should appear first
            if (b_modes.length === 0) {
                return -1;
            }
            a_idx = b_idx = -1;
            // Compare the first (highest) mode
            for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                if (kiwi.gateway.user_prefixes[i].mode === a_modes[0]) {
                    a_idx = i;
                }
            }
            for (i = 0; i < kiwi.gateway.user_prefixes.length; i++) {
                if (kiwi.gateway.user_prefixes[i].mode === b_modes[0]) {
                    b_idx = i;
                }
            }
            if (a_idx < b_idx) {
                return -1;
            } else if (a_idx > b_idx) {
                return 1;
            }
            // If we get to here both a and b have the same highest mode so have to resort to lexicographical sorting

        } else if (b_modes.length > 0) {
            // b has modes but a doesn't so b should appear first
            return 1;
        }
        a_nick = a.get("nick").toLocaleUpperCase();
        b_nick = b.get("nick").toLocaleUpperCase();
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
    },
    initialize: function (options) {
        this.view = new kiwi.view.MemberList({"model": this, "name": options.name});
    },
    getByNick: function (nick) {
        return this.find(function (m) {
            return nick === m.get("nick");
        });
    }
});




kiwi.model.Member = Backbone.Model.extend({
    sortModes: function (modes) {
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
    },
    initialize: function (attributes) {
        var nick, modes, prefix;
        nick = this.stripPrefix(this.get("nick"));

        modes = this.get("modes");
        modes = modes || [];
        this.sortModes(modes);
        this.set({"nick": nick, "modes": modes, "prefix": this.getPrefix(modes)}, {silent: true});
    },
    addMode: function (mode) {
        var modes, prefix;
        modes = this.get("modes");
        modes.push(mode);
        modes = this.sortModes(modes);
        this.set({"prefix": this.getPrefix(modes), "modes": modes});
    },
    removeMode: function (mode) {
        var modes, prefix;
        modes = this.get("modes");
        modes = _.reject(modes, function(m) {
            return m === mode;
        });
        this.set({"prefix": this.getPrefix(modes), "modes": modes});
    },
    getPrefix: function (modes) {
        var prefix = '';
        if (typeof modes[0] !== 'undefined') {
            prefix = _.detect(kiwi.gateway.user_prefixes, function (prefix) {
                return prefix.mode === modes[0];
            });
            prefix = (prefix) ? prefix.symbol : '';
        }
        return prefix;
    },
    stripPrefix: function (nick) {
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
    }
});









kiwi.model.ChannelList = Backbone.Collection.extend({
    model: kiwi.model.Channel,
    comparator: function (chan) {
        return chan.get("name");
    }
});



// TODO: Channel modes
kiwi.model.Channel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;
        this.view = new kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "members": new kiwi.model.MemberList({"name": this.view.htmlsafe_name}),
            "name": name,
            "backscroll": [],
            "topic": ""
        }, {"silent": true});
        this.addMsg(null, ' ', '--> You have joined ' + name, 'action join', 'color:#009900;');
        members = this.get("members");
        members.bind("add", function (member) {
            this.addMsg(null, ' ', '--> ' + member.get("nick") + ' [' + member.get("ident") + '@' + member.get("hostname") + '] has joined', 'action join', 'color:#009900;');
        }, this);
        members.bind("remove", function (member, options) {
            this.addMsg(null, ' ', '<-- ' + member.get("nick") + ' has left ' + ((options.message) ? '(' + options.message + ')' : ''), 'action join', 'color:#009900;');
        }, this);
        members.bind("quit", function (args) {
            this.addMsg(null, ' ', '<-- ' + args.member.get("nick") + ' has quit ' + ((args.message) ? '(' + args.message + ')' : ''), 'action join', 'color:#009900;');
        }, this);
    },
    addMsg: function (time, nick, msg, type, style) {
        var tmp, bs;

        tmp = {"msg": msg, "time": time, "nick": nick, "chan": this.get("name"), "style": style};
        tmp = kiwi.plugs.run('addmsg', tmp);
        if (!tmp) {
            return;
        }
        if (tmp.time === null) {
            d = new Date();
            tmp.time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");
        }

        // The CSS class (action, topic, notice, etc)
        if (typeof tmp.type !== "string") {
            tmp.type = '';
        }

        // Make sure we don't have NaN or something
        if (typeof tmp.msg !== "string") {
            tmp.msg = '';
        }

        bs = this.get("backscroll");
        bs.push(tmp)
        this.set({"backscroll": bs}, {silent:true});
        this.trigger("msg", tmp);
    }
});



















kiwi.model.PanelList = Backbone.Collection.extend({
    model: kiwi.model.Panel,
    comparator: function (chan) {
        return chan.get("name");
    },
    initialize: function () {
        this.server = new kiwi.model.Server({"name": kiwi.gateway.network_name});
        this.view = new kiwi.view.Tabs({"el": $('#toolbar .panellist')[0], "model": this});

        kiwi.currentPanel = this.server;
    },
    getByName: function (name) {
        return this.find(function (c) {
            return name === c.get("name");
        });
    }
});




kiwi.model.Panel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "backscroll": [],
            "name": name
        }, {"silent": true});

        this.isChannel = false;
    },

    addMsg: function (nick, msg, type, opts) {
        var message_obj, bs, d;

        opts = opts || {};

        // Time defaults to now
        if (!opts || typeof opts.time === 'undefined') {
            d = new Date();
            opts.time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");
        }

        // CSS style defaults to empty string
        if (!opts || typeof opts.style === 'undefined') {
            opts.style = '';
        }

        // Run through the plugins
        message_obj = {"msg": msg, "time": opts.time, "nick": nick, "chan": this.get("name"), "style": opts.style};
        //tmp = kiwi.plugs.run('addmsg', message_obj);
        if (!message_obj) {
            return;
        }

        // The CSS class (action, topic, notice, etc)
        if (typeof message_obj.type !== "string") {
            message_obj.type = '';
        }

        // Make sure we don't have NaN or something
        if (typeof message_obj.msg !== "string") {
            message_obj.msg = '';
        }

        // Update the scrollback
        bs = this.get("backscroll");
        bs.push(message_obj)
        this.set({"backscroll": bs}, {silent:true});

        this.trigger("msg", message_obj);
    }
});
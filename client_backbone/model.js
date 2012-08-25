/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */
kiwi.model = {};

kiwi.model.MemberList = Backbone.Collection.extend({
    model: kiwi.model.Member,
    comparator: function (a, b) {
        var i, a_modes, b_modes, a_idx, b_idx, a_nick, b_nick;
        var user_prefixes = kiwi.gateway.get('user_prefixes');
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
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === a_modes[0]) {
                    a_idx = i;
                }
            }
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === b_modes[0]) {
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
        this.view = new kiwi.view.MemberList({"model": this});
    },
    getByNick: function (nick) {
        return this.find(function (m) {
            return nick.toLowerCase() === m.get('nick').toLowerCase();
        });
    }
});

kiwi.model.Member = Backbone.Model.extend({
    sortModes: function (modes) {
        return modes.sort(function (a, b) {
            var a_idx, b_idx, i;
            var user_prefixes = kiwi.gateway.get('user_prefixes');

            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === a) {
                    a_idx = i;
                }
            }
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === b) {
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
        modes = _.reject(modes, function (m) {
            return m === mode;
        });
        this.set({"prefix": this.getPrefix(modes), "modes": modes});
    },
    getPrefix: function (modes) {
        var prefix = '';
        var user_prefixes = kiwi.gateway.get('user_prefixes');

        if (typeof modes[0] !== 'undefined') {
            prefix = _.detect(user_prefixes, function (prefix) {
                return prefix.mode === modes[0];
            });
            prefix = (prefix) ? prefix.symbol : '';
        }
        return prefix;
    },
    stripPrefix: function (nick) {
        var tmp = nick, i, j, k;
        var user_prefixes = kiwi.gateway.get('user_prefixes');
        i = 0;

        for (j = 0; j < nick.length; j++) {
            for (k = 0; k < user_prefixes.length; k++) {
                if (nick.charAt(j) === user_prefixes[k].symbol) {
                    i++;
                    break;
                }
            }
        }

        return tmp.substr(i);
    }
});

kiwi.model.PanelList = Backbone.Collection.extend({
    model: kiwi.model.Panel,
    comparator: function (chan) {
        return chan.get("name");
    },
    initialize: function () {
        this.view = new kiwi.view.Tabs({"el": $('#toolbar .panellist')[0], "model": this});

        // Automatically create a server tab
        this.server = new kiwi.model.Server({'name': kiwi.gateway.get('name')});
        kiwi.gateway.on('change:name', this.view.render, this.view);
        this.add(this.server);

        // Set the default view to the server tab
        kiwi.current_panel = this.server;

    },
    getByName: function (name) {
        return this.find(function (c) {
            return name.toLowerCase() === c.get('name').toLowerCase();
        });
    }
});

kiwi.model.Panel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});
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

        // Escape any HTML that may be in here
        // This doesn't seem right to be here.. should be in view (??)
        msg =  $('<div />').text(msg).html();

        // Run through the plugins
        message_obj = {"msg": msg, "time": opts.time, "nick": nick, "chan": this.get("name"), "type": type, "style": opts.style};
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

        // Convert IRC formatting into HTML formatting
        message_obj.msg = formatIRCMsg(message_obj.msg);

        // Update the scrollback
        bs = this.get("scrollback");
        bs.push(message_obj);

        // Keep the scrolback limited
        if (bs.length > 250) {
            bs.splice(250);
        }
        this.set({"scrollback": bs}, {silent: true});

        this.trigger("msg", message_obj);
    },

    close: function () {
        this.view.remove();
        delete this.view;

        var members = this.get('members');
        if (members) {
            members.reset([]);
            this.unset('members');
        }

        this.destroy();

        if (this.cid === kiwi.current_panel.cid) {
            kiwi.app.panels.server.view.show();
        }
    },

    isChannel: function () {
        var channel_prefix = kiwi.gateway.get('channel_prefix'),
            this_name = this.get('name');

        if (!this_name) return false;
        return (channel_prefix.indexOf(this_name[0]) > -1);
    }
});

kiwi.model.Server = kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var name = "Server";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        this.addMsg(' ', '--> Kiwi IRC: Such an awesome IRC client', '', {style: 'color:#009900;'});
    }
});

// TODO: Channel modes
// TODO: Listen to gateway events for anythign related to this channel
kiwi.model.Channel = kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var that = this,
            name = this.get("name") || "",
            members;

        this.view = new kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "members": new kiwi.model.MemberList(),
            "name": name,
            "scrollback": [],
            "topic": ""
        }, {"silent": true});

        //this.addMsg(' ', '--> You have joined ' + name, 'action join', {style: 'color:#009900;'});

        members = this.get("members");
        members.bind("add", function (member) {
            var disp = member.get("nick") + ' [' + member.get("ident") + '@' + member.get("hostname") + ']';
            this.addMsg(' ', '--> ' + disp + ' has joined', 'action join');
        }, this);

        members.bind("remove", function (member, options) {
            var disp = member.get("nick") + ' [' + member.get("ident") + '@' + member.get("hostname") + ']';
            this.addMsg(' ', '<-- ' + disp + ' has left ' + ((options.message) ? '(' + options.message + ')' : ''), 'action part');
        }, this);

        members.bind("quit", function (args) {
            var disp = member.get("nick") + ' [' + member.get("ident") + '@' + member.get("hostname") + ']';
            this.addMsg(' ', '<-- ' + disp + ' has quit ' + ((args.message) ? '(' + args.message + ')' : ''), 'action quit');
        }, this);
    }
});

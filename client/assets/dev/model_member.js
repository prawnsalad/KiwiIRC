_kiwi.model.Member = Backbone.Model.extend({
    sortModes: function (modes) {
        return modes.sort(function (a, b) {
            var a_idx, b_idx, i;
            var user_prefixes = _kiwi.gateway.get('user_prefixes');

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
        this.isOp();
    },
    addMode: function (mode) {
        var modes_to_add = mode.split(''),
            modes, prefix;

        modes = this.get("modes");
        $.each(modes_to_add, function (index, item) {
            modes.push(item);
        });
        
        modes = this.sortModes(modes);
        this.set({"prefix": this.getPrefix(modes), "modes": modes});
        this.isOp();
    },
    removeMode: function (mode) {
        var modes_to_remove = mode.split(''),
            modes, prefix;

        modes = this.get("modes");
        modes = _.reject(modes, function (m) {
            return (_.indexOf(modes_to_remove, m) !== -1);
        });

        this.set({"prefix": this.getPrefix(modes), "modes": modes});
        this.isOp();
    },
    getPrefix: function (modes) {
        var prefix = '';
        var user_prefixes = _kiwi.gateway.get('user_prefixes');

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
        var user_prefixes = _kiwi.gateway.get('user_prefixes');
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
    },
    displayNick: function (full) {
        var display = this.get('nick');

        if (full) {
            if (this.get("ident")) {
                display += ' [' + this.get("ident") + '@' + this.get("hostname") + ']';
            }
        }

        return display;
    },
    isOp: function () {
        var user_prefixes = _kiwi.gateway.get('user_prefixes'),
            modes = this.get('modes'),
            o, max_mode;
        if (modes.length > 0) {
            o = _.indexOf(user_prefixes, _.find(user_prefixes, function (prefix) {
                return prefix.mode === 'o';
            }));
            max_mode = _.indexOf(user_prefixes, _.find(user_prefixes, function (prefix) {
                return prefix.mode === modes[0];
            }));
            if ((max_mode === -1) || (max_mode > o)) {
                this.set({"is_op": false}, {silent: true});
            } else {
                this.set({"is_op": true}, {silent: true});
            }
        } else {
            this.set({"is_op": false}, {silent: true});
        }
    }
});
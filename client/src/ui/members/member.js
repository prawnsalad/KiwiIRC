define('ui/members/member', function(require, exports, module) {
    module.exports = Backbone.Model.extend({
        initialize: function (attributes) {
            var nick, modes, prefix;

            // The nick may have a mode prefix, we don't want this
            nick = this.stripPrefix(this.get("nick"));

            // Make sure we have a mode array, and that it's sorted
            modes = this.get("modes");
            modes = modes || [];
            this.sortModes(modes);

            this.set({"nick": nick, "modes": modes, "prefix": this.getPrefix(modes)}, {silent: true});

            this.updateOpStatus();

            this.view = new (require('./member_view'))({"model": this});
        },


        /**
         * Sort modes in order of importance
         */
        sortModes: function (modes) {
            var that = this;

            return modes.sort(function (a, b) {
                var a_idx, b_idx, i;
                var user_prefixes = that.get('user_prefixes');

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


        addMode: function (mode) {
            var modes_to_add = mode.split(''),
                modes, prefix;

            modes = this.get("modes");
            $.each(modes_to_add, function (index, item) {
                modes.push(item);
            });

            modes = this.sortModes(modes);
            this.set({"prefix": this.getPrefix(modes), "modes": modes});

            this.updateOpStatus();

            this.view.render();
        },


        removeMode: function (mode) {
            var modes_to_remove = mode.split(''),
                modes, prefix;

            modes = this.get("modes");
            modes = _.reject(modes, function (m) {
                return (_.indexOf(modes_to_remove, m) !== -1);
            });

            this.set({"prefix": this.getPrefix(modes), "modes": modes});

            this.updateOpStatus();

            this.view.render();
        },


        /**
         * Figure out a valid prefix given modes.
         * If a user is an op but also has voice, the prefix
         * should be the op as it is more important.
         */
        getPrefix: function (modes) {
            var prefix = '';
            var user_prefixes = this.get('user_prefixes');

            if (typeof modes[0] !== 'undefined') {
                prefix = _.detect(user_prefixes, function (prefix) {
                    return prefix.mode === modes[0];
                });

                prefix = (prefix) ? prefix.symbol : '';
            }

            return prefix;
        },


        /**
         * Remove any recognised prefix from a nick
         */
        stripPrefix: function (nick) {
            var tmp = nick, i, j, k, nick_char;
            var user_prefixes = this.get('user_prefixes');

            i = 0;

            nick_character_loop:
            for (j = 0; j < nick.length; j++) {
                nick_char = nick.charAt(j);

                for (k = 0; k < user_prefixes.length; k++) {
                    if (nick_char === user_prefixes[k].symbol) {
                        i++;
                        continue nick_character_loop;
                    }
                }

                break;
            }

            return tmp.substr(i);
        },



        /**
         * Format this nick into readable format (eg. nick [ident@hostname])
         */
        displayNick: function (full) {
            var display = this.get('nick');

            if (full) {
                if (this.get("ident")) {
                    display += ' [' + this.get("ident") + '@' + this.get("hostname") + ']';
                }
            }

            return display;
        },


        // Helper to quickly get user mask details
        getMaskParts: function () {
            return {
                nick: this.get('nick') || '',
                ident: this.get('ident') || '',
                hostname: this.get('hostname') || ''
            };
        },


        /**
         * With the modes set on the user, make note if we have some sort of op status
         */
        updateOpStatus: function () {
            var user_prefixes = this.get('user_prefixes'),
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
});
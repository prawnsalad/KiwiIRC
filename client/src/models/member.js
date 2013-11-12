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
        this.view = new _kiwi.view.Member({"model": this});
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
        this.isOp();

        this.view.render();
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
        var tmp = nick, i, j, k, nick_char;
        var user_prefixes = _kiwi.gateway.get('user_prefixes');
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
    },
    richUserlist: function(flags, realname) {
        // Detect and set away status
        if (flags.indexOf('G') > -1) {
            this.set({"is_away": true}, {silent: true});
        } else {
            this.set({"is_away": false}, {silent: true});
        }
        
        // Detect and set ircop status
        if (flags.indexOf('*') > -1) {
            this.set({"is_ircop": true}, {silent: true});
        } else {
            this.set({"is_ircop": false}, {silent: true});
        }

        // Detect and set age
        var checkAge = realname.trim().search(/[0-9]{1,3}/);
        if (checkAge > -1) {
            // Find the complete substring for the age and set it
            var indexEndAge = realname.search(/[A-Z \/\[]/i);
            this.set({"age": realname.substring(checkAge.index, indexEndAge)}, {silent: true});
            
            // For next steps we'll keep a shorter version of the realname
            var trailingRealname = realname.substring(indexEndAge).trim();
        } else {
            var trailingRealname = realname.trim();
            this.set({"age": ''}, {silent: true});
        }
        
        // Detect and set genders
        genders = {'M': ['M002', 'h ', '/H/'], 'F': ['F001', 'f ', '/F/', ' f '], 'U': ['U003']};
        
        for(var gender in genders) {
            var regexList = genders[gender].join('|');
            
            // If gender info is in realname
            if (trailingRealname.match(new RegExp(regexList, 'i'))) {
                this.set({"gender": gender}, {silent: true});
                
                // Find the gender info length to remove it from realname
                for(var myRegex in genders[gender]) {
                    if (trailingRealname.match(new RegExp(genders[gender][myRegex], 'i'))) {
                        var trailingRealname = trailingRealname.substring(genders[gender][myRegex].length).trim();
                        break;
                    }
                }
                break;
            }
            // If we have an age, we'll try a bit harder
            else if (indexEndAge > -1) {
                if (trailingRealname.match(new RegExp(gender, 'i'))) {
                    this.set({"gender": gender}, {silent: true});
                    break;
                }
                trailingRealname = trailingRealname.substring(gender.length);
            }
            else {
                this.set({"gender": 'U'}, {silent: true});
            }
        }

        // Set the remaining realname info (should be user's location or realname for users that haven't set ASL)
        this.set({"info": trailingRealname}, {silent: true});
        
        
        // All rich nicklist info is set, time to render the nicklist
        this.view.enrich();
    }
});
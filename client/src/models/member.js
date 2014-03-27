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
        var genders, info, temp_gender, regex_list, my_regex, gender_string,
            is_away = false,
            is_ircop = false,
            age = '',
            gender = 'U',
            temp_realname = [];
        console.log('ok');
        // Detect and set away status
        if (_kiwi.global.settings.get('rich_nicklist_track_away') && flags.indexOf('G') > -1) {
            is_away = true;
        }
        
        // Detect and set ircop status
        if (_kiwi.global.settings.get('rich_nicklist_track_ircop') && flags.indexOf('*') > -1) {
            is_ircop = true;
        }

        if (_kiwi.global.settings.get('rich_nicklist_track_asl')) {
            // Detect ASL
            genders = _kiwi.global.settings.get('rich_nicklist_gender_regexes');
            // If we didn't find the genders regexes, stop here
            if (!genders) return;
            
            for(temp_gender in genders) {
                regex_list = genders[temp_gender].join('|');
    
                // If gender info is in realname
                if (realname.match(new RegExp(regex_list, 'i'))) {
                    gender = temp_gender;
                    
                    // Fing the gender info to split realname into ASL
                    for(my_regex in genders[temp_gender]) {
                        // Test the different gender regexes
                        if (realname.match(new RegExp(genders[temp_gender][my_regex], 'i'))) {
                            // Clean the gender regex to split the realname around it
                            gender_string = genders[temp_gender][my_regex].replace(/[\^\$]/g, '');
                            temp_realname = realname.split(new RegExp(gender_string, 'i'));
                            
                            // Push the traling realname into info
                            if(temp_realname.length > 1) {
                                info = temp_realname[1];
                            }
                            // If we've got here we've found all we can so stop looping
                            break;
                        }
                    }
                }
                // Set the age
                if (temp_realname[0] && temp_realname[0].match(/[0-9]/)) {
                    age = temp_realname[0];
                }
                
                // If we've got an age or a gender at this stage, we've done the job
                if (age !== '' || gender !== 'U') {
                    break;
                } else {
                    info = realname;
                }
            }
        }

        // Set the remaining realname info (should be user's location or realname for users that haven't set ASL)
        this.set({'is_away': is_away, 'is_ircop': is_ircop, 'age': age, 'gender': gender, 'info': info}, {silent: true});
        
        
        // All rich nicklist info is set, time to render the nicklist
        this.view.enrich();
    }
});
define('ui/members/memberlist', function(require, exports, module) {

    var utils = require('helpers/utils');

    module.exports = Backbone.Collection.extend({
        model: require('./member'),
        comparator: function (a, b) {
            var i, a_modes, b_modes, a_idx, b_idx, a_nick, b_nick;
            var user_prefixes = this.channel.get('network').get('user_prefixes');

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
            a_nick = a.get("nick").toLocaleLowerCase();
            b_nick = b.get("nick").toLocaleLowerCase();
            // Lexicographical sorting
            if (a_nick < b_nick) {
                return -1;
            } else if (a_nick > b_nick) {
                return 1;
            } else {
                return 0;
            }
        },


        initialize: function (options) {
            this.view = new (require('./memberlist_view'))({"model": this});
            this.initNickCache();
        },


        /*
         * Keep a reference to each member by the nick. Speeds up .getByNick()
         * so it doesn't need to loop over every model for each nick lookup
         */
        initNickCache: function() {
            var updateRegex = _.bind(function () {
                    // Allows checking for a nick that contains 'the_nick' or '<punctuation>the_nick<punctuation>'
                    // .. where <punctuation> is any character not allowed in an IRC nick
                    var regex_valid_nick_chars = 'a-z0-9_\\-{}[\\]^`|\\\\';
                    var regex_nicks = Object.keys(this.nick_cache)
                        .map(_.escapeRegExp)
                        .join('|');

                    this.nick_regex = new RegExp(
                        '^[^'+regex_valid_nick_chars+']?(' + regex_nicks + ')[^'+regex_valid_nick_chars+']?$', 'i'
                    );
                }, this);

            function getNick (member) {
                return member.get('nick').toLowerCase();
            }

            this.nick_cache = Object.create(null);
            this.nick_regex = null;

            this.on('reset', function() {
                this.nick_cache = _.reduce(this.models, function(memo, member) {
                    memo[getNick(member)] = member;
                    return memo;
                }, Object.create(null));
                updateRegex();
            });

            this.on('add', function(member) {
                this.nick_cache[getNick(member)] = member;
                updateRegex();
            });

            this.on('remove', function(member) {
                delete this.nick_cache[getNick(member)];
                updateRegex();
            });

            this.on('change:nick', function(member) {
                this.nick_cache[getNick(member)] = member;
                delete this.nick_cache[member.previous('nick').toLowerCase()];
                updateRegex();
            });
        },

        getByNick: function (nick) {
            var matches;
            if (this.nick_regex && (matches = this.nick_regex.exec(nick))) {
                return this.nick_cache[matches[1].toLowerCase()];
            }
        }
    });
});

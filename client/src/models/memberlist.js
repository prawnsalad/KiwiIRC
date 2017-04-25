_kiwi.model.MemberList = Backbone.Collection.extend({
    model: _kiwi.model.Member,
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
        a_nick = a.get("nick").toLocaleUpperCase();
        b_nick = b.get("nick").toLocaleUpperCase();
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
        this.view = new _kiwi.view.MemberList({"model": this});
        this.initNickCache();
    },


    /*
     * Keep a reference to each member by the nick. Speeds up .getByNick()
     * so it doesn't need to loop over every model for each nick lookup
     */
    initNickCache: function() {
        var that = this;

        this.nick_cache = Object.create(null);

        this.on('reset', function() {
            this.nick_cache = Object.create(null);

            this.models.forEach(function(member) {
                that.nick_cache[member.get('nick').toLowerCase()] = member;
            });
        });

        this.on('add', function(member) {
            that.nick_cache[member.get('nick').toLowerCase()] = member;
        });

        this.on('remove', function(member) {
            delete that.nick_cache[member.get('nick').toLowerCase()];
        });

        this.on('change:nick', function(member) {
            that.nick_cache[member.get('nick').toLowerCase()] = member;
            delete that.nick_cache[member.previous('nick').toLowerCase()];
        });
    },


    getByNick: function (nick) {
        if (typeof nick !== 'string') return;
        return this.nick_cache[nick.toLowerCase()];
    }
});
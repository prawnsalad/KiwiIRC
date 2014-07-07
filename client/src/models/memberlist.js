define(function (require, exports, module) {

var Member = require('../models/member');
var MemberList = require('../views/memberlist');

module.exports = Backbone.Collection.extend({
    model: Member,
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
        this.view = new MemberList({"model": this});
    },
    getByNick: function (nick) {
        if (typeof nick !== 'string') return;
        return this.find(function (m) {
            return nick.toLowerCase() === m.get('nick').toLowerCase();
        });
    }
});
});
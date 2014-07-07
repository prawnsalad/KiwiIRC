define(function (require, exports, module) {

var Channel = require('./channel');
var ChannelView = require('../views/channel');

console.log(Channel, ChannelView);

module.exports = Channel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.view = new ChannelView({"model": this, "name": name});
        this.set({
            "name": name,
            "scrollback": []
        }, {"silent": true});
    },

    isChannel: function () {
        return false;
    },

    isQuery: function () {
        return true;
    }
});
});
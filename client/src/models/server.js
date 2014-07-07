define(function (require, exports, module) {

var Channel = require('../models/channel');
var ChannelView = require('../views/channel');

module.exports = Channel.extend({
    initialize: function (attributes) {
        var name = "Server";
        this.view = new ChannelView({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        //this.addMsg(' ', '--> Kiwi IRC: Such an awesome IRC client', '', {style: 'color:#009900;'});
    },

    isServer: function () {
        return true;
    },

    isChannel: function () {
        return false;
    }
});
});
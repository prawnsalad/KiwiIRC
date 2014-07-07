define(function (require, exports, module) {

var ChannelInfo = require('../views/channelinfo');

module.exports = Backbone.Model.extend({
    initialize: function () {
        this.view = new ChannelInfo({"model": this});
    }
});
});
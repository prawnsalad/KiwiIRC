define(function (require, exports, module) {

var ChannelInfo = require('../models/channelinfo');

module.exports = Backbone.View.extend({
    events: {
        'click .channel_info': 'infoClick',
        'click .channel_part': 'partClick'
    },

    initialize: function () {},

    infoClick: function (event) {
        new ChannelInfo({channel: _kiwi.app.panels().active});
    },

    partClick: function (event) {
        _kiwi.app.connections.active_connection.gateway.part(_kiwi.app.panels().active.get('name'));
    }
});
});
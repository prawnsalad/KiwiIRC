_melon.view.ChannelTools = Backbone.View.extend({
    events: {
        'click .channel_info': 'infoClick',
        'click .channel_part': 'partClick'
    },

    initialize: function () {},

    infoClick: function (event) {
        new _melon.model.ChannelInfo({channel: _melon.app.panels().active});
    },

    partClick: function (event) {
        _melon.app.connections.active_connection.gateway.part(_melon.app.panels().active.get('name'));
    }
});
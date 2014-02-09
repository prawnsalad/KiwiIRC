_kiwi.view.ChannelTools = Backbone.View.extend({
    events: {
        'click .channel_info': 'infoClick',
        'click .channel_part': 'partClick'
    },

    initialize: function () {},

    infoClick: function (event) {
        new _kiwi.model.ChannelInfo({channel: _kiwi.app.panels().active});
    },

    partClick: function (event) {
        _kiwi.gateway.part(null, _kiwi.app.panels().active.get('name'));
    }
});
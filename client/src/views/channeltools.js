define('views/channeltools', function(require, exports, module) {
    module.exports = Backbone.View.extend({
        events: {
            'click .channel_info': 'infoClick',
            'click .channel_part': 'partClick'
        },

        initialize: function () {},

        infoClick: function (event) {
            new (require('models/channelinfo'))({channel: _kiwi.app.panels().active});
        },

        partClick: function (event) {
            _kiwi.app.connections.active_connection.gateway.part(_kiwi.app.panels().active.get('name'));
        }
    });
});
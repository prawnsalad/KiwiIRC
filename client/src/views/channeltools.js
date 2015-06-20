define('views/channeltools', function(require, exports, module) {

    var Application = require('models/application');

    module.exports = Backbone.View.extend({
        events: {
            'click .channel_info': 'infoClick',
            'click .channel_part': 'partClick'
        },

        initialize: function () {},

        infoClick: function (event) {
            new (require('models/channelinfo'))({channel: Application.instance().panels().active});
        },

        partClick: function (event) {
            Application.instance().connections.active_connection.gateway.part(Application.instance().panels().active.get('name'));
        }
    });
});
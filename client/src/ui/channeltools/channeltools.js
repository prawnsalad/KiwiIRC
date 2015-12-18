define('ui/channeltools/channeltools', function(require, exports, module) {

    var Application = require('ui/application/');

    module.exports = Backbone.View.extend({
        events: {
            'click .channel-info': 'infoClick',
            'click .channel-part': 'partClick'
        },

        initialize: function () {},

        infoClick: function (event) {
            new (require('ui/channelinfo/channelinfo'))({channel: Application.instance().panels().active});
        },

        partClick: function (event) {
            Application.instance().connections.active_connection.gateway.part(Application.instance().panels().active.get('name'));
        }
    });
});

define('ui/apptoolbar/', function(require, exports, module) {

    var Application = require('ui/application/');

    module.exports = Backbone.View.extend({
        events: {
            'click .settings': 'clickSettings',
            'click .startup': 'clickStartup'
        },

        initialize: function () {
            // Remove the new connection/startup link if the server has disabled server changing
            if (Application.instance().server_settings.connection && Application.instance().server_settings.connection.restricted) {
                this.$('.startup').css('display', 'none');
            }
        },

        clickSettings: function (event) {
            event.preventDefault();
            Application.instance().controlbox.processInput('/settings');
        },

        clickStartup: function (event) {
            event.preventDefault();
            Application.instance().startup_applet.view.show();
        }
    });
});
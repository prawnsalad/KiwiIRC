_kiwi.view.AppToolbar = Backbone.View.extend({
    events: {
        'click .settings': 'clickSettings',
        'click .startup': 'clickStartup' ,
        'click .hiderightbar': 'clickHideRightBar'
    },

    initialize: function () {
        // Remove the new connection/startup link if the server has disabled server changing
        if (_kiwi.app.server_settings.connection && !_kiwi.app.server_settings.connection.allow_change) {
            this.$('.startup').css('display', 'none');
        }
    },

    clickSettings: function (event) {
        event.preventDefault();
        _kiwi.app.controlbox.processInput('/settings');
    },

    clickStartup: function (event) {
        event.preventDefault();
        _kiwi.app.startup_applet.view.show();
    },

    clickHideRightBar: function (event) {
        event.preventDefault();
        $(".right_bar").toggle();
        $(".memberlists_resize_handle").toggle();
        _kiwi.app.view.doLayout();
    }
});

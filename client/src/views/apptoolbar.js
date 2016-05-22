_kiwi.view.AppToolbar = Backbone.View.extend({
    events: {
        'click .settings': 'clickSettings',
        'click .startup': 'clickStartup',
        'click .tabs_menu': 'clickTabsMenu'
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

    clickTabsMenu: function (event) {
        event.preventDefault();
        _kiwi.app.view.$el.toggleClass('with_sidebar');
        _kiwi.app.view.$el.find('.toolbar_overlay').click(function() {
            _kiwi.app.view.$el.removeClass('with_sidebar');
        });
    }
});

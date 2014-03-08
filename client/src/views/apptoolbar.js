_kiwi.view.AppToolbar = Backbone.View.extend({
    events: {
        'click .settings': 'clickSettings',
        'click .startup': 'clickStartup'
    },

    initialize: function () {
    },

    clickSettings: function (event) {
        event.preventDefault();
        _kiwi.app.controlbox.processInput('/settings');
    },

    clickStartup: function (event) {
        event.preventDefault();
        _kiwi.app.startup_applet.view.show();
    },
});
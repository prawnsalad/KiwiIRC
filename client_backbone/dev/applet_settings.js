(function () {
    var View = Backbone.View.extend({
        events: {
            'click .save': 'saveSettings'
        },

        initialize: function (options) {
            this.$el = $($('#tmpl_applet_settings').html());
        },
        
        saveSettings: function () {
            var theme = $('.theme', this.$el).val();

            // Clear any current theme
            kiwi.app.view.$el.removeClass(function (i, css) {
                return (css.match (/\btheme_\S+/g) || []).join(' ');
            });

            if (theme) kiwi.app.view.$el.addClass('theme_' + theme);
        }
    });



    kiwi.applets.Settings = Backbone.Model.extend({
        initialize: function () {
            this.set('title', 'Settings');
            this.view = new View();
        }
    });
})();
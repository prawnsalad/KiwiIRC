(function () {
    var View = Backbone.View.extend({
        events: {
            'click .save': 'saveSettings'
        },

        initialize: function (options) {
            this.$el = $($('#tmpl_applet_settings').html());
        },
        
        saveSettings: function () {
            var theme = $('.theme', this.$el).val(),
                containers = $('#panels > .panel_container');

            // Clear any current theme
            containers.removeClass(function (i, css) {
                return (css.match (/\btheme_\S+/g) || []).join(' ');
            });

            if (theme) containers.addClass('theme_' + theme);
        }
    });



    kiwi.applets.nickserv = Backbone.Model.extend({
        initialize: function () {
            this.set('title', 'Nickserv Login');
            //this.view = new View();

            kiwi.global.control.on('command_login', this.loginCommand, this);
        },

        loginCommand: function (event) {
            console.log('waheeyy');
        }
    });
})();
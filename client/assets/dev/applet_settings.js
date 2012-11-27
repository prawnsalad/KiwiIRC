(function () {
    var View = Backbone.View.extend({
        events: {
            'click .save': 'saveSettings'
        },

        initialize: function (options) {
            this.$el = $($('#tmpl_applet_settings').html());

            // Incase any settings change while we have this open, update them
            _kiwi.global.settings.on('change', this.loadSettings, this);

            // Now actually show the current settings
            this.loadSettings();


        },
        

        loadSettings: function () {
            var settings = _kiwi.global.settings;

            this.$el.find('.setting-theme').val(settings.get('theme') || 'relaxed');
            this.$el.find('.setting-scrollback').val(settings.get('scrollback') || '250');

            if (typeof settings.get('show_joins_parts') === 'undefined' || settings.get('show_joins_parts')) {
                this.$el.find('.setting-show_joins_parts').attr('checked', true);
            } else {
                this.$el.find('.setting-show_joins_parts').attr('checked', false);
            }
        },


        saveSettings: function () {
            var settings = _kiwi.global.settings;

            settings.set('theme', $('.setting-theme', this.$el).val());
            settings.set('scrollback', $('.setting-scrollback', this.$el).val());
            settings.set('show_joins_parts', $('.setting-show_joins_parts', this.$el).is(':checked'));

            settings.save();
        }
    });



    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', 'Settings');
            this.view = new View();
        }
    });


    _kiwi.model.Applet.register('kiwi_settings', Applet);
})();
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

            // TODO: Tidy this up
            var theme = settings.get('theme') || 'relaxed';
            this.$el.find('.setting-theme option').filter(function() {
                return $(this).val() === theme;
            }).attr('selected', true);

            var list_style = settings.get('channel_list_style') || 'tabs';
            this.$el.find('.setting-channel_list_style option').filter(function() {
                return $(this).val() === list_style;
            }).attr('selected', true);

            this.$el.find('.setting-scrollback').val(settings.get('scrollback') || '250');

            if (typeof settings.get('show_joins_parts') === 'undefined' || settings.get('show_joins_parts')) {
                this.$el.find('.setting-show_joins_parts').attr('checked', true);
            } else {
                this.$el.find('.setting-show_joins_parts').attr('checked', false);
            }

            if (typeof settings.get('show_timestamps') === 'undefined' || !settings.get('show_timestamps')) {
                this.$el.find('.setting-show_timestamps').attr('checked', false);
            } else {
                this.$el.find('.setting-show_timestamps').attr('checked', true);
            }

            if (typeof settings.get('mute_sounds') === 'undefined' || settings.get('mute_sounds')) {
                this.$el.find('.setting-mute_sounds').attr('checked', true);
            } else {
                this.$el.find('.setting-mute_sounds').attr('checked', false);
            }
        },


        saveSettings: function () {
            var settings = _kiwi.global.settings,
                feedback;

            // Stop settings being updated while we're saving one by one
            _kiwi.global.settings.off('change', this.loadSettings, this);

            settings.set('theme', $('.setting-theme', this.$el).val());
            settings.set('channel_list_style', $('.setting-channel_list_style', this.$el).val());
            settings.set('scrollback', $('.setting-scrollback', this.$el).val());
            settings.set('show_joins_parts', $('.setting-show_joins_parts', this.$el).is(':checked'));
            settings.set('show_timestamps', $('.setting-show_timestamps', this.$el).is(':checked'));
            settings.set('mute_sounds', $('.setting-mute_sounds', this.$el).is(':checked'));

            settings.save();

            feedback = $('.feedback', this.$el);
            feedback.fadeIn('slow', function () {
                feedback.fadeOut('slow');
            })

            // Continue listening for setting changes
            _kiwi.global.settings.on('change', this.loadSettings, this);
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
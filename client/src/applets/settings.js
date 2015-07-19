(function () {
    var View = Backbone.View.extend({
        events: {
            'change [data-setting]': 'saveSettings',
            'click [data-setting="theme"]': 'selectTheme',
            'click .register_protocol': 'registerProtocol',
            'click .enable_notifications': 'enableNotifications',
            'click .show-category': 'onClickShowCategory'
        },

        initialize: function (options) {
            var text = {
                messages              : translateText('client_applets_settings_messages'),
                chat_messages         : translateText('client_applets_settings_chat_messages'),
                alerts_notifications  : translateText('client_applets_settings_alerts_notifications'),
                appearance            : translateText('client_applets_settings_appearance'),
                theme                 : translateText('client_applets_settings_theme'),
                channels              : translateText('client_applets_settings_channels'),
                tabs                  : translateText('client_applets_settings_channelview_tabs'),
                list                  : translateText('client_applets_settings_channelview_list'),
                large_amounts_of_chans: translateText('client_applets_settings_channelview_list_notice'),
                language              : translateText('client_applets_settings_language'),
                join_part             : translateText('client_applets_settings_notification_joinpart'),
                count_all_activity    : translateText('client_applets_settings_notification_count_all_activity'),
                timestamps            : translateText('client_applets_settings_timestamp'),
                timestamp_24          : translateText('client_applets_settings_timestamp_24_hour'),
                mute                  : translateText('client_applets_settings_notification_sound'),
                emoticons             : translateText('client_applets_settings_emoticons'),
                queries               : translateText('client_applets_settings_ignore_new_queries'),
                scroll_history        : translateText('client_applets_settings_history_length'),
                languages             : _kiwi.app.translations,
                default_client        : translateText('client_applets_settings_default_client'),
                make_default          : translateText('client_applets_settings_default_client_enable'),
                locale_restart_needed : translateText('client_applets_settings_locale_restart_needed'),
                default_note          : translateText('client_applets_settings_default_client_notice', '<a href="chrome://settings/handlers">chrome://settings/handlers</a>'),
                html5_notifications   : translateText('client_applets_settings_html5_notifications'),
                enable_notifications  : translateText('client_applets_settings_enable_notifications'),
                custom_highlights     : translateText('client_applets_settings_custom_highlights'),
                theme_thumbnails: _.map(_kiwi.app.themes, function (theme) {
                    return _.template($('#tmpl_theme_thumbnail').html().trim(), theme);
                })
            };
            this.$el = $(_.template($('#tmpl_applet_settings').html().trim(), text));

            if (!navigator.registerProtocolHandler) {
                this.$('.protocol_handler').remove();
            }

            if (_kiwi.utils.notifications.allowed() !== null) {
                this.$('.notification_enabler').remove();
            }

            // Incase any settings change while we have this open, update them
            _kiwi.global.settings.on('change', this.loadSettings, this);

            // Now actually show the first cetegory of settings
            this.showCategory('appearance');

        },

        loadSettings: function () {

            _.each(_kiwi.global.settings.attributes, function(value, key) {

                var $el = this.$('[data-setting="' + key + '"]');

                // Only deal with settings we have a UI element for
                if (!$el.length)
                    return;

                switch ($el.prop('type')) {
                    case 'checkbox':
                        $el.prop('checked', value);
                        break;
                    case 'radio':
                        this.$('[data-setting="' + key + '"][value="' + value + '"]').prop('checked', true);
                        break;
                    case 'text':
                        $el.val(value);
                        break;
                    case 'select-one':
                        this.$('[value="' + value + '"]').prop('selected', true);
                        break;
                    default:
                        this.$('[data-setting="' + key + '"][data-value="' + value + '"]').addClass('active');
                        break;
                }
            }, this);
        },

        saveSettings: function (event) {
            var value,
                settings = _kiwi.global.settings,
                $setting = $(event.currentTarget);

            switch (event.currentTarget.type) {
                case 'checkbox':
                    value = $setting.is(':checked');
                    break;
                case 'radio':
                case 'text':
                    value = $setting.val();
                    break;
                case 'select-one':
                    value = $(event.currentTarget[$setting.prop('selectedIndex')]).val();
                    break;
                default:
                    value = $setting.data('value');
                    break;
            }

            // Stop settings being updated while we're saving one by one
            _kiwi.global.settings.off('change', this.loadSettings, this);
            settings.set($setting.data('setting'), value);
            settings.save();

            if ($setting.data('setting') === 'locale') {
                $.getJSON(_kiwi.global.opts.base_path + '/assets/locales/' + value + '.json', function (locale) {
                    if (locale) {
                        _kiwi.global.i18n.update_locale(locale);
                        _kiwi.global.i18n.translateDOM(_kiwi.app.get('container')[0]);
                    }
                });
            }

            // Continue listening for setting changes
            _kiwi.global.settings.on('change', this.loadSettings, this);
        },

        selectTheme: function(event) {
            event.preventDefault();

            this.$('[data-setting="theme"].active').removeClass('active');
            $(event.currentTarget).addClass('active').trigger('change');
        },

        registerProtocol: function (event) {
            event.preventDefault();

            navigator.registerProtocolHandler('irc', document.location.origin + _kiwi.app.get('base_path') + '/%s', 'Kiwi IRC');
            navigator.registerProtocolHandler('ircs', document.location.origin + _kiwi.app.get('base_path') + '/%s', 'Kiwi IRC');
        },

        enableNotifications: function(event){
            event.preventDefault();
            var notifications = _kiwi.utils.notifications;

            notifications.requestPermission().always(_.bind(function () {
                if (notifications.allowed() !== null) {
                    this.$('.notification_enabler').remove();
                }
            }, this));
        },


        showCategory: function(category) {
            this.$('.settings-category').removeClass('active');
            this.$('.settings-category-' + category).addClass('active');

            this.$('.show-category').removeClass('active');
            this.$('.show-category-' + category).addClass('active');

            // Load the current settings
            this.loadSettings();
        },


        onClickShowCategory: function(event) {
            var category = $(event.currentTarget).data('category');
            if (category) {
                this.showCategory(category);
            }
        }

    });


    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', translateText('client_applets_settings_title'));
            this.view = new View();
        }
    });


    _kiwi.model.Applet.register('kiwi_settings', Applet);
})();

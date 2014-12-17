(function () {
    var View = Backbone.View.extend({
        events: {
            'change [data-setting]': 'saveSettings',
            'click [data-setting="theme"]': 'selectTheme',
            'click .register_protocol': 'registerProtocol',
            'click .enable_notifications': 'enableNotifications'
        },

        initialize: function (options) {
            function t(key, vars) {
                var trans = _kiwi.global.i18n.translate(key);
                return trans.fetch.apply(trans, Array.prototype.slice.call(arguments, 1));
            }
            var text = {
                tabs                  : t('client_applets_settings_channelview_tabs'),
                list                  : t('client_applets_settings_channelview_list'),
                large_amounts_of_chans: t('client_applets_settings_channelview_list_notice'),
                join_part             : t('client_applets_settings_notification_joinpart'),
                count_all_activity    : t('client_applets_settings_notification_count_all_activity'),
                timestamps            : t('client_applets_settings_timestamp'),
                timestamp_24          : t('client_applets_settings_timestamp_24_hour'),
                mute                  : t('client_applets_settings_notification_sound'),
                emoticons             : t('client_applets_settings_emoticons'),
                scroll_history        : t('client_applets_settings_history_length'),
                languages             : _kiwi.app.translations,
                default_client        : t('client_applets_settings_default_client'),
                make_default          : t('client_applets_settings_default_client_enable'),
                locale_restart_needed : t('client_applets_settings_locale_restart_needed'),
                default_note          : t('client_applets_settings_default_client_notice', '<a href="chrome://settings/handlers">chrome://settings/handlers</a>'),
                html5_notifications   : t('client_applets_settings_html5_notifications'),
                enable_notifications  : t('client_applets_settings_enable_notifications'),
                theme_thumbnails: _.map(_kiwi.app.themes, function (theme) {
                    return _.template($('#tmpl_theme_thumbnail').html().trim(), theme);
                })
            };
            this.$el = $(_.template($('#tmpl_applet_settings').html().trim(), text));

            if (!navigator.registerProtocolHandler) {
                this.$('.protocol_handler').remove();
            }

            if (!(window.Notification || window.webkitNotifications || window.mozNotification)) {
                this.$('notification_enabler').remove();
            }

            // Incase any settings change while we have this open, update them
            _kiwi.global.settings.on('change', this.loadSettings, this);

            // Now actually show the current settings
            this.loadSettings();

        },

        loadSettings: function () {

            var that = this;

            $.each(_kiwi.global.settings.attributes, function(key, value) {

                var $el = that.$('[data-setting="' + key + '"]');

                // Only deal with settings we have a UI element for
                if (!$el.length)
                    return;

                switch ($el.prop('type')) {
                    case 'checkbox':
                        $el.prop('checked', value);
                        break;
                    case 'radio':
                        $('[data-setting="' + key + '"][value="' + value + '"]', that.$el).prop('checked', true);
                        break;
                    case 'text':
                        $el.val(value);
                        break;
                    case 'select-one':
                        $('[value="' + value + '"]', that.$el).prop('selected', true);
                        break;
                    default:
                        $('[data-setting="' + key + '"][data-value="' + value + '"]', that.$el).addClass('active');
                        break;
                }
            });
        },

        saveSettings: function (event) {
            var value,
                settings = _kiwi.global.settings,
                $setting = this.$(event.currentTarget);

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

        enableNotifications: function(event) {
            event.preventDefault();
            var Notify = window.Notification || window.webkitNotifications;

            if (Notify) {
                Notify.requestPermission();
            }
        }

    });


    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', _kiwi.global.i18n.translate('client_applets_settings_title').fetch());
            this.view = new View();
        }
    });


    _kiwi.model.Applet.register('kiwi_settings', Applet);
})();

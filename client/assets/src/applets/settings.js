(function () {
    var View = Backbone.View.extend({
        events: {
            'change [data-setting]': 'saveSettings',
            'click [data-setting="theme"]': 'selectTheme',
            'click .register_protocol': 'registerProtocol',
            'click .enable_notifications': 'enableNoticiations'
        },

        initialize: function (options) {
            var text = {
                tabs: _kiwi.global.i18n.translate('client_applets_settings_channelview_tabs').fetch(),
                list: _kiwi.global.i18n.translate('client_applets_settings_channelview_list').fetch(),
                large_amounts_of_chans: _kiwi.global.i18n.translate('client_applets_settings_channelview_list_notice').fetch(),
                join_part: _kiwi.global.i18n.translate('client_applets_settings_notification_joinpart').fetch(),
                timestamps: _kiwi.global.i18n.translate('client_applets_settings_timestamp').fetch(),
                mute: _kiwi.global.i18n.translate('client_applets_settings_notification_sound').fetch(),
                emoticons: _kiwi.global.i18n.translate('client_applets_settings_emoticons').fetch(),
                scroll_history: _kiwi.global.i18n.translate('client_applets_settings_history_length').fetch(),
                languages: _kiwi.app.translations,
                default_client: _kiwi.global.i18n.translate('client_applets_settings_default_client').fetch(),
                make_default: _kiwi.global.i18n.translate('client_applets_settings_default_client_enable').fetch(),
                locale_restart_needed: _kiwi.global.i18n.translate('client_applets_settings_locale_restart_needed').fetch(),
                default_note: _kiwi.global.i18n.translate('client_applets_settings_default_client_notice').fetch('<a href="chrome://settings/handlers">chrome://settings/handlers</a>'),
                html5_notifications: _kiwi.global.i18n.translate('client_applets_settings_html5_notifications').fetch(),
                enable_notifications: _kiwi.global.i18n.translate('client_applets_settings_enable_notifications').fetch()
            };
            this.$el = $(_.template($('#tmpl_applet_settings').html().trim(), text));

            if (!navigator.registerProtocolHandler) {
                this.$el.find('.protocol_handler').remove();
            }

            if (!window.webkitNotifications) {
                this.$el.find('notification_enabler').remove();
            }

            // Incase any settings change while we have this open, update them
            _kiwi.global.settings.on('change', this.loadSettings, this);

            // Now actually show the current settings
            this.loadSettings();

        },

        loadSettings: function () {

            var that = this;

            $.each(_kiwi.global.settings.attributes, function(key, value) {

                var $el = $('[data-setting="' + key + '"]', that.$el);

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
                $setting = $(event.currentTarget, this.$el);

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
            $('[data-setting="theme"].active', this.$el).removeClass('active');
            $(event.currentTarget).addClass('active').trigger('change');
            event.preventDefault();
        },

        registerProtocol: function (event) {
            navigator.registerProtocolHandler('irc', document.location.origin + _kiwi.app.get('base_path') + '/%s', 'Kiwi IRC');
            navigator.registerProtocolHandler('ircs', document.location.origin + _kiwi.app.get('base_path') + '/%s', 'Kiwi IRC');
        },

        enableNoticiations: function(event){
            window.webkitNotifications.requestPermission();
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

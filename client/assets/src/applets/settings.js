(function () {
	var View = Backbone.View.extend({
		events: {
			'change [data-setting]': 'saveSettings',
			'click [data-setting="theme"]': 'selectTheme'
		},

		initialize: function (options) {
			this.$el = $($('#tmpl_applet_settings').html().trim());

			// Incase any settings change while we have this open, update them
			_kiwi.global.settings.on('change', this.loadSettings, this);

			// Now actually show the current settings
			this.loadSettings();

		},

		loadSettings: function () {

			var	settings = _kiwi.global.settings,
				theme = settings.get('theme') || 'relaxed',
				channel_style = settings.get('channel_list_style') || 'tabs',
				scrollback = settings.get('scrollback') || '250';

			$('[data-setting="theme"][data-value="' + theme + '"]', this.$el).addClass('active');

			$('[data-setting="channel_list_style"][value="' + channel_style + '"]', this.$el).prop('checked', true);

			if (typeof settings.get('show_joins_parts') === 'undefined' || settings.get('show_joins_parts')) {
				$('[data-setting="show_joins_parts"]', this.$el).prop('checked', true);
			} else {
				$('[data-setting="show_joins_parts"]', this.$el).prop('checked', false);
			}

			if (typeof settings.get('show_timestamps') === 'undefined' || settings.get('show_timestamps')) {
				$('[data-setting="show_timestamps"]', this.$el).prop('checked', true);
			} else {
				$('[data-setting="show_timestamps"]', this.$el).prop('checked', false);
			}

			if (typeof settings.get('mute_sounds') === 'undefined' || settings.get('mute_sounds')) {
				$('[data-setting="mute_sounds"]', this.$el).prop('checked', true);
			} else {
				$('[data-setting="mute_sounds"]', this.$el).prop('checked', false);
			}

			$('[data-setting="scrollback"]', this.$el).val(scrollback);
		},

		saveSettings: function (event) {
			var value,
				settings = _kiwi.global.settings,
				$setting = $(event.currentTarget, this.$el)

			switch (event.currentTarget.type) {
				case 'checkbox':
					value = $setting.is(':checked');
					break;
				case 'radio':
				case 'text':
					value = $setting.val();
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
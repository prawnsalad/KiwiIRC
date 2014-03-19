_kiwi.view.TextTheme = _kiwi.view.Panel.extend({
	initialize: function(text_theme) {
		this.text_theme = text_theme;
	},
	getText: function(string_id, params, trailing = '') {
		var translation;
		
		translation = _kiwi.global.i18n.translate(string_id).fetch(params);
		
		return translation + trailing;
	},
	styleText: function(string_id, params, trailing = '') {
		var style, text;
		
		style = formatToIrcMsg(_kiwi.global.text_theme.options[string_id]);
		text = this.getText(string_id, params, trailing);
		
		return style.replace('%T', text);
	}
});
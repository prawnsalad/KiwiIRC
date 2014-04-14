/**
 * TEXT THEMES SYNTAX
 * 
 * %N: nickname
 * %C[digit]: color
 * %C: channel
 * %J: ident
 * %H: host
 * %R: realname
 * %B: bold
 * %I: italic
 * %U: underline
 * %O: cancel styles
 * %T: translated text
 **/

_kiwi.view.TextTheme = _kiwi.view.Panel.extend({
	initialize: function(text_theme) {
		this.text_theme = text_theme;
	},
	styleText: function(string_id, params) {
		var style, text;
		
		style = formatToIrcMsg(_kiwi.global.text_theme.options[string_id]);
		
		// Bring member info back to first level of params
		if (params['%M']) {
			for(key in params['%M']) {
				params[key] = params['%M'][key];
			}
		}

		// Do the magic. Use the shorthand syntax to produce output.
		text = style.replace(/%([TJHNCR])/g, function(match, key) {
			key = '%' + key;

			if (typeof params[key.toUpperCase()] !== 'undefined')
				return params[key.toUpperCase()];
		});
		return text;
	}
});
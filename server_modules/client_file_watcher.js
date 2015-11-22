/**
 * Watch CSS and themes files for changes
 *
 * Alerts the client to reload any CSS files on changes
 */

var fs = require('fs');
var path = require('path');
var kiwiModules = require('../server/modules');

var module = new kiwiModules.Module('client_file_watcher');

// Watch the common stylesheets
fs.watch('client/assets/css', alertClients);


// Watch the theme stylesheets
var themes = (global.config.client_themes || ['relaxed']);
themes.forEach(function(theme) {
	var dir = path.join(global.config.public_http, '/assets/themes/', theme);
	fs.watch(dir, alertClients);
});


function alertClients() {
	global.clients.broadcastKiwiCommand('asset_files_changes');
};

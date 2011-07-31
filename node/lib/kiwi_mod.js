/*
 * Kiwi module handler
 *
 * To run module events:
 *     kiwi_mod.run(event_name, obj);
 *
 * - Each module call must return obj, with or without changes.
 * - If a module call returns null, the event is considered cancelled
 *   and null is passed back to the caller to take action.
 *   For example, if null is returned for onmsg, kiwi stops sending
 *   the message to any clients.
*/

this.loaded_modules = {};


exports.loadModules = function(){
	// Warn each module it is about to be unloaded
	this.run('unload');
	this.loaded_modules = {};

	// Load each module and run the onload event
	for(var i in config.modules){
		var mod_name = config.modules[i];
		this.loaded_modules[mod_name] = require(kiwi_root + '/' + config.module_dir + mod_name);
	}
	this.run('load');
}

exports.run = function (event_name, event_data, opts){
	var ret = event_data;
	
	event_data = (typeof event_data === 'undefined') ? {} : event_data;
	opts = (typeof opts === 'undefined') ? {} : opts;
	
	for (var mod_name in this.loaded_modules) {
		if (typeof this.loaded_modules[mod_name]['on' + event_name] === 'function') {
			ret = this.loaded_modules[mod_name]['on' + event_name](ret, opts);
			if (ret === null) return null;
		}
	}

	return ret;
}

exports.printMods = function(){
	console.log('Loaded Kiwi modules');
	for (var mod_name in this.loaded_modules) {
		console.log(' - ' + mod_name);
	}
}
// Holds anything kiwi client specific (ie. front, gateway, _kiwi.plugs..)
/**
*   @namespace
*/
var _kiwi = {};

_kiwi.model = {};
_kiwi.view = {};
_kiwi.applets = {};


/**
 * A global container for third party access
 * Will be used to access a limited subset of kiwi functionality
 * and data (think: plugins)
 */
_kiwi.global = {
	settings: undefined,
	utils: undefined, // Re-usable methods
	gateway: undefined,
	user: undefined,
	server: undefined,
	command: undefined,  // The control box

	// TODO: think of a better term for this as it will also refer to queries
	channels: undefined,

	// Entry point to start the kiwi application
	start: function (opts) {
		opts = opts || {};

        // Load the plugin manager
        _kiwi.global.plugins = new _kiwi.model.PluginManager();

        // Set up the settings datastore
        _kiwi.global.settings = _kiwi.model.DataStore.instance('kiwi.settings');
        _kiwi.global.settings.load();

		_kiwi.app = new _kiwi.model.Application(opts);

		if (opts.kiwi_server) {
			_kiwi.app.kiwi_server = opts.kiwi_server;
		}

		// Start the client up
		_kiwi.app.start();

		return true;
	}
};



// If within a closure, expose the kiwi globals
if (typeof global !== 'undefined') {
	global.kiwi = _kiwi.global;
} else {
	// Not within a closure so set a var in the current scope
	var kiwi = _kiwi.global;
}
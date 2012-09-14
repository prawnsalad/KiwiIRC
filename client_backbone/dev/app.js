// Holds anything kiwi client specific (ie. front, gateway, kiwi.plugs..)
/**
*   @namespace
*/
var kiwi = {};

kiwi.model = {};
kiwi.view = {};


/**
 * A global container for third party access
 * Will be used to access a limited subset of kiwi functionality
 * and data (think: plugins)
 */
kiwi.global = {
	gateway: undefined,
	user: undefined,
	server: undefined,
	channels: undefined,

	// Entry point to start the kiwi application
	start: function (opts) {
		opts = opts || {};

		kiwi.app = new kiwi.model.Application(opts);

		if (opts.kiwi_server) {
			kiwi.app.kiwi_server = opts.kiwi_server;
		}

		kiwi.app.start();

		return true;
	},

	utils: undefined // Re-usable methods
};



// If within a closure, expose the kiwi globals
if (typeof global !== 'undefined') {
	global.kiwi = kiwi.global;
}
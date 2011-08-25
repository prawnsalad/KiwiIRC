/*jslint node: true, sloppy: true, forin: true, maxerr: 50, indent: 4 */
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

var kiwi = require('../kiwi.js');
this.loaded_modules = {};


exports.loadModules = function (kiwi_root, config) {
    var i, mod_name;
    // Warn each module it is about to be unloaded
    this.run('unload');
    this.loaded_modules = {};

    // Load each module and run the onload event
    for (i in kiwi.config.modules) {
        mod_name = kiwi.config.modules[i];
        this.loaded_modules[mod_name] = require(kiwi_root + '/' + kiwi.config.module_dir + mod_name);
    }
    this.run('load');
};

exports.run = function (event_name, event_data, opts) {
    var ret = event_data,
        mod_name;
    
    event_data = (typeof event_data === 'undefined') ? {} : event_data;
    opts = (typeof opts === 'undefined') ? {} : opts;
    
    for (mod_name in this.loaded_modules) {
        if (typeof this.loaded_modules[mod_name]['on' + event_name] === 'function') {
            ret = this.loaded_modules[mod_name]['on' + event_name](ret, opts);
            if (ret === null) {
                return null;
            }
        }
    }

    return ret;
};

exports.printMods = function () {
    var mod_name;
    console.log('Loaded Kiwi modules');
    for (mod_name in this.loaded_modules) {
        console.log(' - ' + mod_name);
    }
};

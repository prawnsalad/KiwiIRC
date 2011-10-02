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
var fs = require('fs');
this.loaded_modules = {};


/*
 * Load any unloaded modules as set in config
 */
exports.loadModules = function (kiwi_root, config) {
    var i, mod_name;
    // Warn each module it is about to be unloaded
    //this.run('unload');
    //this.loaded_modules = {};

    // Load each module and run the onload event
    for (i in kiwi.config.modules) {
        mod_name = kiwi.config.modules[i];
        if (typeof this.loaded_modules[mod_name] !== 'undefined') continue;

        this.loaded_modules[mod_name] = require(kiwi.kiwi_root + '/' + kiwi.config.module_dir + mod_name);
    }
    this.run('load');
};


/*
 * Unload and reload a specific module
 */
exports.reloadModule = function (mod_name) {
    fs.realpath(kiwi.kiwi_root + '/' + kiwi.config.module_dir + mod_name + '.js', function(err, resolvedPath){
        try {
            var mod_path = resolvedPath;

            if (typeof kiwi.kiwi_mod.loaded_modules[mod_name] !== 'undefined') {
                delete kiwi.kiwi_mod.loaded_modules[mod_name];
            }
            if (typeof require.cache[mod_path] !== 'undefined') {
                delete require.cache[mod_path];
            }

            kiwi.kiwi_mod.loaded_modules[mod_name] = null;
            kiwi.kiwi_mod.loaded_modules[mod_name] = require(mod_path);

            console.log('Module ' + mod_name + ' reloaded.');
        } catch (e) {
            console.log('reloadModule error!');
            console.log(e);
            return false;
        }
    });

    //return this.loaded_modules[mod_name] ? true : false;
};


/*
 * Run an event against all loaded modules
 */
exports.run = function (event_name, event_data, opts) {
    var ret = event_data,
        ret_tmp, mod_name;
    
    event_data = (typeof event_data === 'undefined') ? {} : event_data;
    opts = (typeof opts === 'undefined') ? {} : opts;
    
    for (mod_name in this.loaded_modules) {
        if (typeof this.loaded_modules[mod_name]['on' + event_name] === 'function') {
            try {
                ret_tmp = this.loaded_modules[mod_name]['on' + event_name](ret, opts);
                if (ret_tmp === null) {
                    return null;
                }
                ret = ret_tmp;
            } catch (e) {
            }
        }
    }

    return ret;
};

exports.printMods = function () {
    var mod_name;
    console.log('Loaded Kiwi modules:');
    for (mod_name in this.loaded_modules) {
        console.log(' - ' + mod_name);
    }
};

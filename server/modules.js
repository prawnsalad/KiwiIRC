var events = require('events'),
    util = require('util'),
    _ = require('lodash'),
    EventPublisher = require('./plugininterface.js');


/**
 * Publisher
 * The main point in which events are fired and bound to
 */

// Where events are bound to
var active_publisher;


// Create a publisher to allow event subscribing
function Publisher (obj) {
    var EventPublisher = require('./plugininterface.js');
    return new EventPublisher();
}


// Register an already created Publisher() as the active instance
function registerPublisher (obj) {
    active_publisher = obj;
}






/**
 * Keeping track of modules
 */

// Hold the loaded modules
var registered_modules = {};

function loadModule (module_file) {
    var module;

    // Get an instance of the module and remove it from the cache
    try {
        module = require(module_file);
        delete require.cache[require.resolve(module_file)];
    } catch (err) {
        // Module was not found
        console.log(err);
        return false;
    }

    return module;
}


// Find a registered collection, .dispose() of it and remove it
function unloadModule (module) {
    registered_modules = _.reject(registered_modules, function (registered_module) {
        if (module === registered_module) {
            module.dispose();
            return true;
        }
    });
}






/**
 * Module object
 * To be created by modules to bind to server events
 */
function Module (module_name) {
    registered_modules[module_name] = this;
}


// Holder for all the bound events by this module
Module.prototype._events = {};


// Keep track of this modules events and bind
Module.prototype.on = function (event_name, fn) {
    var internal_events = ['dispose'];

    this._events[event_name] = this._events[event_name] || [];
    this._events[event_name].push(fn);

    // If this is an internal event, do not propogate the event
    if (internal_events.indexOf(event_name) === -1) {
        active_publisher.on(event_name, fn);
    }
};


// Keep track of this modules events and bind once
Module.prototype.once = function (event_name, fn) {
    this._events[event_name] = this._events[event_name] || [];
    this._events[event_name].push(fn);

    active_publisher.once(event_name, fn);
};


// Remove any events by this module only
Module.prototype.off = function (event_name, fn) {
    var idx;

    if (typeof event_name === 'undefined') {
        // Remove all events
        this._events = [];

    } else if (typeof fn === 'undefined') {
        // Remove all of 1 event type
        delete this._events[event_name];

    } else {
        // Remove a single event + callback
        for (idx in (this._events[event_name] || [])) {
            if (this._events[event_name][idx] === fn) {
                delete this._events[event_name][idx];
            }
        }
    }

    active_publisher.removeListener(event_name, fn);
};



// Clean up anything used by this module
Module.prototype.dispose = function () {
    // Call any dispose callbacks
    (this._events['dispose'] || []).forEach(function (callback) {
        callback();
    });

    // Remove all bound event listeners
    this.off();
};






module.exports = {
    // Objects
    Module: Module,
    Publisher: Publisher,

    // Methods
    registerPublisher: registerPublisher,
    load: loadModule,
    unload: unloadModule,
    getRegisteredModules: function () { return registered_modules; }
};

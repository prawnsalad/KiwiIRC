var events = require('events'),
	util = require('util');


// Where events are bound to
var active_publisher;


// Create a publisher to allow event subscribing
function Publisher (obj) {
	var EventPublisher = function modulePublisher() {};
	util.inherits(EventPublisher, events.EventEmitter);

	return new EventPublisher();
}


// Register an already created Publisher() as the active instance
function registerPublisher (obj) {
	active_publisher = obj;
}




/**
 * Module object
 * To be created by modules to bind to server events
 */
function Module (module_name) {}


// Holder for all the bound events by this module
Module.prototype._events = {};


// Keep track of this modules events and bind
Module.prototype.subscribe = function (event_name, fn) {
	this._events[event_name] = this._events[event_name] || [];
	this._events[event_name].push(fn);

	active_publisher.on(event_name, fn);
};


// Keep track of this modules events and bind once
Module.prototype.once = function (event_name, fn) {
	this._events[event_name] = this._events[event_name] || [];
	this._events[event_name].push(fn);

	active_publisher.once(event_name, fn);
};


// Remove any events by this module only
Module.prototype.unsubscribe = function (event_name, fn) {
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
	this.unsubscribe();
};






module.exports = {
	// Objects
	Module: Module,
	Publisher: Publisher,

	// Methods
	registerPublisher: registerPublisher
};
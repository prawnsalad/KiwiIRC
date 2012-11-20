var events = require('events'),
	util = require('util');


// Where events are bound to
var active_publisher;


// Create a publisher to allow event subscribing
function Publisher (obj) {
	var EventPublisher = function pluginPublisher() {};
	util.inherits(EventPublisher, events.EventEmitter);

	return new EventPublisher();
};


// Register an already created Publisher() as the active instance
function registerPublisher (obj) {
	active_publisher = obj;
}



function Plugin (plugin_name) {

	// Holder for all the bound events by this plugin
	var bound_events = {};

	// Handy function to be a little more consistant with EventEmitter
	this._events = function () {
		return bound_events;
	};


	// Keep track of this plugins events and bind
	this.subscribe = function (event_name, fn) {
		bound_events[event_name] = bound_events[event_name] || [];
		bound_events[event_name].push(fn);

		global.plugins.on(event_name, fn);
	};


	// Keep track of this plugins events and bind once
	this.once = function (event_name, fn) {
		bound_events[event_name] = bound_events[event_name] || [];
		bound_events[event_name].push(fn);

		global.plugins.once(event_name, fn);
	};


	// Remove any events by this plugin only
	this.unsubscribe = function (event_name, fn) {
		var idx;

		if (typeof event_name === 'undefined') {
			// Remove all events
			bound_events = [];

		} else if (typeof fn === 'undefined') {
			// Remove all of 1 event type
			delete bound_events[event_name];

		} else {
			// Remove a single event + callback
			for (idx in (bound_events[event_name] || [])) {
				if (bound_events[event_name][idx] === fn) {
					delete bound_events[event_name][idx];
				}
			}
		}

		global.plugins.removeListener(event_name, fn);
	};


	// Clean up anything used by this plugin
	this.dispose = function () {
		this.unsubscribe();
	};
};



module.exports = {
	// Objects
	Plugin: Plugin,
	Publisher: Publisher,

	// Methods
	registerPublisher: registerPublisher
};
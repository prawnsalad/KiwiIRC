var _ = require('lodash');

var IrcEventBinder = function () {};

module.exports = IrcEvents;



IrcEvents.prototype.bindIrcEvents = function (events_scope, event_map, context, irc_connection) {
    _.each(event_map, function (fn, event_name) {
        // Bind the event to `context`, storing it with the event listing
        if (!event_map[event_name].bound_fn) {
            event_map[event_name].bound_fn = fn.bind(context);
        }

        // Add the listener to the IRC connection object
        irc_connection.on(events_scope + ':' + event_name, event_map[event_name].bound_fn);
    });
};


IrcEvents.prototype.unbindIrcEvents = function (events_scope, event_map, irc_connection) {
    _.each(event_map, function(fn, event_name) {
        if (event_map[event_name].bound_fn) {
            // Remove the listener from the IRC connection object
            irc_connection.removeListener(events_scope + ':' + event_name, event_map[event_name].bound_fn);

            // Remove the bound function as no longer needed
            event_map[event_name].bound_fn = undefined;
        }
    });
};
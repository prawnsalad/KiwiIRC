var _ = require('lodash');


module.exports.bindIrcEvents = function (events_scope, event_map, context, irc_connection) {
    // Make sure we have a holder for the bound events
    if (!event_map._bound_events)
        event_map._bound_events = {};

    _.each(event_map, function (fn, event_name) {
        if (event_name[0] === '_') return;

        // Bind the event to `context`, storing it with the event listing
        if (!event_map._bound_events[event_name]) {
            event_map._bound_events[event_name] = fn.bind(context);
        }

        // Add the listener to the IRC connection object
        irc_connection.on(events_scope + ':' + event_name, event_map._bound_events[event_name]);
    });
};


module.exports.unbindIrcEvents = function (events_scope, event_map, irc_connection) {
    // No bound events? Then we have nothing to do
    if (!event_map._bound_events) return;

    _.each(event_map, function(fn, event_name) {
        if (event_name[0] === '_') return;

        if (event_map._bound_events[event_name]) {
            // Remove the listener from the IRC connection object
            irc_connection.removeListener(events_scope + ':' + event_name, event_map._bound_events[event_name]);

            // Remove the bound function as no longer needed
            event_map._bound_events[event_name] = undefined;
        }
    });
};
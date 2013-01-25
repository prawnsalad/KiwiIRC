var Binder = function () {};

module.exports = Binder;

Binder.prototype.bindEvents = function () {
    var that = this;
    this.irc_events.forEach(function (fn, event_name, irc_events) {
        // Bind the event to `that` context, storing it with the event listing
        if (!irc_events[event_name].bound_fn) {
            irc_events[event_name].bound_fn = fn.bind(that);
        }

        this.irc_connection.on(this.scope + ':' + event_name, irc_events[event_name].bound_fn);
    });
};


Binder.prototype.unbindEvents = function () {
    this.irc_events.forEach(function(fn, event_name, irc_events) {
        if (irc_events[event_name].bound_fn) {
            this.irc_connection.removeListener(this.scope + ':' + event_name, irc_events[event_name].bound_fn);
        }
    });
};
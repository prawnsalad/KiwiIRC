var _ = require('lodash');

var Binder = function () {};

module.exports = Binder;

Binder.prototype.bindEvents = function () {
    var that = this;
    _.each(this.irc_events, function (fn, event_name, irc_events) {
        // Bind the event to `that` context, storing it with the event listing
        if (!irc_events[event_name].bound_fn) {
            irc_events[event_name].bound_fn = fn.bind(that);
        }

        that.irc_connection.on(that.scope + ':' + event_name, irc_events[event_name].bound_fn);
    });
};


Binder.prototype.unbindEvents = function () {
    var that = this;
    _.each(this.irc_events, function(fn, event_name, irc_events) {
        if (irc_events[event_name].bound_fn) {
            that.irc_connection.removeListener(that.scope + ':' + event_name, irc_events[event_name].bound_fn);
        }
    });
};
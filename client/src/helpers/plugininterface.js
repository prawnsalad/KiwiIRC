/*
 * The same functionality as EventEmitter but with the inclusion of callbacks
 */



function PluginInterface () {
    // Holder for all the bound listeners by this module
    this._listeners = {};
}



PluginInterface.prototype.on = function (event_name, fn, scope) {
    this._listeners[event_name] = this._listeners[event_name] || [];
    this._listeners[event_name].push(['on', fn, scope]);
};



PluginInterface.prototype.once = function (event_name, fn, scope) {
    this._listeners[event_name] = this._listeners[event_name] || [];
    this._listeners[event_name].push(['once', fn, scope]);
};



PluginInterface.prototype.off = function (event_name, fn, scope) {
    var idx;

    if (typeof event_name === 'undefined') {
        // Remove all listeners
        this._listeners = {};

    } else if (typeof fn === 'undefined') {
        // Remove all of 1 event type
        delete this._listeners[event_name];

    } else if (typeof scope === 'undefined') {
        // Remove a single event type + callback
        for (idx in (this._listeners[event_name] || [])) {
            if (this._listeners[event_name][idx][1] === fn) {
                delete this._listeners[event_name][idx];
            }
        }
    } else {
        // Remove a single event type + callback + scope
        for (idx in (this._listeners[event_name] || [])) {
            if (this._listeners[event_name][idx][1] === fn && this._listeners[event_name][idx][2] === scope) {
                delete this._listeners[event_name][idx];
            }
        }
    }
};



// Call all the listeners for a certain event, passing them some event data that may be changed
PluginInterface.prototype.emit = function (event_name, event_data) {
    var emitter = new this.EmitCall(event_name, event_data);
    var listeners = this._listeners[event_name] || [];

    // Once emitted, remove any 'once' bound listeners
    emitter.then(function () {
        var len = listeners.length,
            idx;

        for(idx = 0; idx < len; idx++) {
            if (listeners[idx][0] === 'once') {
                listeners[idx] = undefined;
            }
        }
    });

    // Emit the event to the listeners and return
    emitter.callListeners(listeners);
    return emitter;
};



// Promise style object to emit events to listeners
PluginInterface.prototype.EmitCall = function EmitCall (event_name, event_data) {
    var that = this,
        completed = false,
        completed_fn = [],

        // Has event.preventDefault() been called
        prevented = false,
        prevented_fn = [];


    // Emit this event to an array of listeners
    function callListeners(listeners) {
        var current_event_idx = -1;

        // Make sure we have some data to pass to the listeners
        event_data = event_data || undefined;

        // If no bound listeners for this event, leave now
        if (listeners.length === 0) {
            emitComplete();
            return;
        }


        // Call the next listener in our array
        function nextListener() {
            var listener, event_obj;

            // We want the next listener
            current_event_idx++;

            // If we've ran out of listeners end this emit call
            if (!listeners[current_event_idx]) {
                emitComplete();
                return;
            }

            // Object the listener ammends to tell us what it's going to do
            event_obj = {
                // If changed to true, expect this listener is going to callback
                wait: false,

                // If wait is true, this callback must be called to continue running listeners
                callback: function () {
                    // Invalidate this callback incase a listener decides to call it again
                    event_obj.callback = undefined;

                    nextListener.apply(that);
                },

                // Prevents the default 'done' functions from executing
                preventDefault: function () {
                    prevented = true;
                }
            };


            listener = listeners[current_event_idx];
            listener[1].call(listener[2] || that, event_obj, event_data);

            // If the listener hasn't signalled it's going to wait, proceed to next listener
            if (!event_obj.wait) {
                // Invalidate the callback just incase a listener decides to call it anyway
                event_obj.callback = undefined;

                nextListener();
            }
        }

        nextListener();
    }



    function emitComplete() {
        completed = true;

        var funcs = prevented ? prevented_fn : completed_fn;
        funcs = funcs || [];

        // Call the completed/prevented functions
        for (var idx = 0; idx < funcs.length; idx++) {
            if (typeof funcs[idx] === 'function') funcs[idx]();
        }
    }



    function addCompletedFunc(fn) {
        // Only accept functions
        if (typeof fn !== 'function') return false;

        completed_fn.push(fn);

        // If we have already completed the emits, call this now
        if (completed && !prevented) fn();

        return this;
    }



    function addPreventedFunc(fn) {
        // Only accept functions
        if (typeof fn !== 'function') return false;

        prevented_fn.push(fn);

        // If we have already completed the emits, call this now
        if (completed && prevented) fn();

        return this;
    }


    return {
        callListeners: callListeners,
        then: addCompletedFunc,
        catch: addPreventedFunc
    };
};



// If running a node module, set the exports
if (typeof module === 'object' && typeof module.exports !== 'undefined') {
    module.exports = PluginInterface;
}



/*
 * Example usage
 */


/*
var modules = new PluginInterface();



// A plugin
modules.on('irc message', function (event, data) {
    //event.wait = true;
    setTimeout(event.callback, 2000);
});




// Core code that is being extended by plugins
var data = {
    nick: 'prawnsalald',
    command: '/dothis'
};

modules.emit('irc message', data).done(function () {
    console.log('Your command is: ' + data.command);
});
*/
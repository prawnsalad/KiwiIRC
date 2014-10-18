function PluginInterface() {
    this.listeners = [];
}

PluginInterface.prototype.on = PluginInterface.prototype.addListener = function addListener(type, listener) {
    if (typeof listener !== 'function') {
        throw new TypeError('listener must be a function');
    }

    if (this.listeners[type]) {
        if (!_.contains(this.listeners[type], listener)) {
            this.listeners[type].push(listener);
        }
    } else {
        this.listeners[type] = [listener];
    }

    return this;
};

PluginInterface.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function') {
        throw new TypeError('listener must be a function');
    }

    var fired = false;

    function g() {
        this.removeListener(type, g);

        if (!fired) {
            fired = true;
            listener.apply(this, arguments);
        }
    }

    g.listener = listener;
    this.on(type, g);

    return this;
};

PluginInterface.prototype.off = PluginInterface.prototype.removeListener = function removeListener(type, listener) {
    if (!this.listeners[type]) {
        return this;
    }

    this.listeners[type] = _.without(this.listeners[type], listener);

    return this;
};

PluginInterface.prototype.emit = function emit(type, data) {
    var that = this;

    return new Promise(function (emit_resolve, emit_reject) {
        var rejected = false,
            rejected_reasons = [],
            listeners_promise;

        if (!that.listeners[type]) {
            return emit_resolve(data);
        }

        // Add each listener as a promise .then()
        listeners_promise = that.listeners[type].reduce(function (listener_promise, listener) {
            return listener_promise.then(function (data) {
                return new Promise(function (resolve) {
                    var event_data = {
                        callback: function () {
                            resolve(data);
                            event_data.callback = null;
                        },
                        preventDefault: function (reason) {
                            rejected = true;
                            if (reason) {
                                rejected_reasons.push(reason);
                            }
                        },
                        wait: false
                    };

                    listener(event_data, data);

                    // If the module has not specified that we should wait, callback now
                    if (!event_data.wait && event_data.callback) {
                        event_data.callback();
                    }
                });
            });
        }, Promise.resolve(data));

        // After all the listeners have been called, resolve back with any modified data
        listeners_promise.then(function (data) {
            if (rejected) {
                emit_reject({data: data, reasons: rejected_reasons});
            } else {
                emit_resolve(data);
            }
        });
    });
};

// If running a node module, set the exports
if (typeof module === 'object' && typeof module.exports !== 'undefined') {
    module.exports = PluginInterface;
}

/* Test cases

var p = new PluginInterface();
p.on('test', function (event, data) {
    data.a += '!';
    event.callback();
});

p.emit('test', {a: 'hello world'}).then(function (data) {
    if (data.a === 'hello world!') {
        console.log('Test passed');
    } else {
        console.error('Test failed!');
    }
}, function (err) {
    console.error('Test failed!');
});


var p = new PluginInterface();
p.on('test', function (event, data) {
    data.a += '!';
    event.callback();
});
p.on('test', function (event) {
    event.preventDefault('testing');
    event.callback();
})

p.emit('test', {a:'hello world'}).then(function (){
    console.error('Test failed!');
}, function (data, reasons) {
    if ((data.data.a === 'hello world!') && (data.reasons.length === 1 && data.reasons[0] === 'testing')) {
        console.log('Test passed');
    } else {
        console.error('Test failed!');
    }
});

*/

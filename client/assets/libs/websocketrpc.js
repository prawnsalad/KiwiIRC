/*
    Create a document explaining the protocol
*/

function WebsocketRpc(eio_socket) {
    var self = this;

    this._next_id = 0;
    this._callbacks = {};
    this._socket = eio_socket;

    this._root_namespace = this;
    this._namespaces = new Object(null);

    this._mixinEmitter();
    this._bindSocketListeners();
}


WebsocketRpc.prototype._bindSocketListeners = function() {
    var self = this;

    // Proxy the onMessage listener
    this._onMessageProxy = function rpcOnMessageBoundFunction(){
        self._onMessage.apply(self, arguments);
    };
    this._socket.on('message', this._onMessageProxy);
};



WebsocketRpc.prototype.dispose = function() {
    if (this._onMessageProxy) {
        this._socket.off('message', this._onMessageProxy);
        delete this._onMessageProxy;
    }

    this.disposeNamespaces();
};


WebsocketRpc.prototype.disposeNamespaces = function() {
    for (var namespace in this._namespaces) {
        this._namespaces[namespace].dispose();
        this._namespaces[namespace] = null;
    }
};


/**
 * The engine.io socket already has an emitter mixin so steal it from there
 */
WebsocketRpc.prototype._mixinEmitter = function() {
    var funcs = ['on', 'once', 'off', 'removeListener', 'removeAllListeners', 'emit', 'listeners', 'hasListeners'];

    for (var i=0; i<funcs.length; i++) {
        this[funcs[i]] = this._socket[funcs[i]];
    }
};


/**
 * Check if a packet is a valid RPC call
 */
WebsocketRpc.prototype._isCall = function(packet) {
    return (typeof packet.method !== 'undefined' &&
            typeof packet.params !== 'undefined');
};


/**
 * Check if a packet is a valid RPC response
 */
WebsocketRpc.prototype._isResponse = function(packet) {
    return (typeof packet.id !== 'undefined' &&
            typeof packet.response !== 'undefined');
};



WebsocketRpc.prototype.namespace = function(namespace) {
    // Does this namespace already exist?
    if (this._namespaces[namespace]) {
        return this._namespaces[namespace];
    }

    var ns = new WebsocketRpcNamespace(this, namespace);
    ns._root_namespace = this._root_namespace;
console.log('Created namespace', namespace);
    this._namespaces[namespace] = ns;

    return ns;
};


/**
 * Make an RPC call
 * First argument must be the method name to call
 * If the last argument is a function, it is used as a callback
 * All other arguments are passed to the RPC method
 * Eg. Rpc.call('namespace.method_name', 1, 2, 3, callbackFn)
 */
WebsocketRpc.prototype.call = function(method) {
    var params, callback, packet;

    // Get a normal array of passed in params
    params = Array.prototype.slice.call(arguments, 1, arguments.length);

    // If the last param is a function, take it as a callback and strip it out
    if (typeof params[params.length-1] === 'function') {
        callback = params[params.length-1];
        params = params.slice(0, params.length-1);
    }

    packet = {
        method: method,
        params: params
    };

    if (typeof callback === 'function') {
        packet.id = this._next_id;

        this._next_id++;
        this._callbacks[packet.id] = callback;
    }

    this.send(packet);
};


/**
 * Encode the packet into JSON and send it over the websocket
 */
WebsocketRpc.prototype.send = function(packet) {
    if (this._socket)
        this._socket.send(JSON.stringify(packet));
};


/**
 * Handler for the websocket `message` event
 */
WebsocketRpc.prototype._onMessage = function(message_raw) {
    var self = this,
        packet,
        returnFn;

    try {
        packet = JSON.parse(message_raw);
        if (!packet) throw 'Corrupt packet';
    } catch(err) {
        return;
    }

    if (this._isResponse(packet)) {
        this._callbacks[packet.id].apply(this, packet.response);
        delete this._callbacks[packet.id];

    } else if (this._isCall(packet)) {
        // Calls with an ID may be responded to
        if (typeof packet.id !== 'undefined') {
            returnFn = function returnCallFn() {
                var value = Array.prototype.slice.call(arguments, 0);

                var ret_packet = {
                    id: packet.id,
                    response: value
                };

                self.send(ret_packet);
            };

        } else {
            returnFn = function noop(){};
        }
console.log(packet.method);
        this.emit.apply(this, [packet.method, returnFn].concat(packet.params));

        // Forward the call on to any matching namespaces
        this._forwardCall(packet, returnFn);
    }
};


/**
 * Take a call and forward it on to any matching namespaces
 */
WebsocketRpc.prototype._forwardCall = function(packet, returnFn) {
    var ns;

    for (var namespace in this._namespaces) {
        ns = this._namespaces[namespace];

        // If the method name is in this namespace, strip the namespace string off
        // and emit the remaining method on the namespace object
        // (namespace.api.method_name() becomes method_name())
        if (packet.method.indexOf(namespace) === 0) {
            ns.emit.apply(ns, [packet.method.replace(namespace + '.', ''), returnFn].concat(packet.params));
            ns._forwardCall(packet, returnFn);
        }
    }
};





function WebsocketRpcNamespace(parent_rpc, new_namespace) {
    var self = this,
        to_bind, i;

    this._namespaces = new Object(null);

    this._parent = parent_rpc;
    this._namespace = new_namespace;

    if (this._namespace.substr(-1) !== '.')
        this._namespace += '.';

    // Proxy these functions from _parent, appending our namespace in the first argument
    to_bind = ['namespace', 'on', 'once', 'off', 'removeListener', 'removeAllListeners', 'emit', 'listeners', 'hasListeners'];
    for (i=0; i<to_bind.length; i++)
        this.bindFnOverride(to_bind[i], true);

    this.bindFnOverride('call', false, this._parent);

    // Proxy these functions from _parent
    to_bind = ['disposeNamespaces', '_forwardCall'];
    for (i=0; i<to_bind.length; i++)
        this[to_bind[i]] = this._parent[to_bind[i]];
}


WebsocketRpcNamespace.prototype.bindFnOverride = function(fn_name, append_first_arg, context) {
    var self = this;

    this[fn_name] = function appendNamespaceFnOverrideBound() {
        var args;

        if (append_first_arg) {
            args = Array.prototype.slice.call(arguments, 0, arguments.length);
            args[0] = self._namespace + args[0];
        }

        return self._parent[fn_name].apply(context || self, args || arguments);
    };
};


WebsocketRpcNamespace.prototype.dispose = function() {
    this.disposeNamespaces();
    this.call = this.on = this.off = this.namespace = this.disposeNamespaces = null;
    this._parent = null;
    this.off();
};



// If running a node module, set the exports
if (typeof module === 'object' && typeof module.exports !== 'undefined') {
    module.exports = WebsocketRpc;
}

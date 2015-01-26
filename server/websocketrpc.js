/*
    TODO:
    Create a document explaining the protocol
    Some way to expire unused callbacks? TTL? expireCallback() function?
*/

/**
 * Wrapper around creating a new WebsocketRpcCaller
 * This lets us use the WebsocketRpc object as a function
 */
function WebsocketRpc(eio_socket) {
    var caller = new WebsocketRpcCaller(eio_socket);
    var ret = function WebsocketRpcInstance() {
        return ret.makeCall.apply(ret, arguments);
    };

    for(var prop in caller){
        ret[prop] = caller[prop];
    }

    ret._mixinEmitter();
    ret._bindSocketListeners();

    // Keep a reference to the main Rpc object so namespaces can find calling functions
    ret._rpc = ret;

    return ret;
}


function WebsocketRpcCaller(eio_socket) {
    this._next_id = 0;
    this._rpc_callbacks = {};
    this._socket = eio_socket;

    this._rpc = this;
    this._namespace = '';
    this._namespaces = [];
}


WebsocketRpcCaller.prototype._bindSocketListeners = function() {
    var self = this;

    // Proxy the onMessage listener
    this._onMessageProxy = function rpcOnMessageBoundFunction(){
        self._onMessage.apply(self, arguments);
    };
    this._socket.on('message', this._onMessageProxy);
};



WebsocketRpcCaller.prototype.dispose = function() {
    if (this._onMessageProxy) {
        this._socket.removeListener('message', this._onMessageProxy);
        delete this._onMessageProxy;
    }

    // Clean up any namespaces
    for (var idx in this._namespaces) {
        this._namespaces[idx].dispose();
    }

    this.removeAllListeners();
};



WebsocketRpcCaller.prototype.namespace = function(namespace_name) {
    var complete_namespace, namespace;

    if (this._namespace) {
        complete_namespace = this._namespace + '.' + namespace_name;
    } else {
        complete_namespace = namespace_name;
    }

    namespace = new this._rpc.Namespace(this._rpc, complete_namespace);
    this._rpc._namespaces.push(namespace);

    return namespace;
};



// Find all namespaces that either matches or starts with namespace_name
WebsocketRpcCaller.prototype._findRelevantNamespaces = function(namespace_name) {
    var found_namespaces = [];

    for(var idx in this._namespaces) {
        if (this._namespaces[idx]._namespace === namespace_name) {
            found_namespaces.push(this._namespaces[idx]);
        }

        if (this._namespaces[idx]._namespace.indexOf(namespace_name + '.') === 0) {
            found_namespaces.push(this._namespaces[idx]);
        }
    }

    return found_namespaces;
};



/**
 * The engine.io socket already has an emitter mixin so steal it from there
 */
WebsocketRpcCaller.prototype._mixinEmitter = function(target_obj) {
    var funcs = ['on', 'once', 'off', 'removeListener', 'removeAllListeners', 'emit', 'listeners', 'hasListeners'];

    target_obj = target_obj || this;

    for (var i=0; i<funcs.length; i++) {
        if (typeof this._socket[funcs[i]] === 'function')
            target_obj[funcs[i]] = this._socket[funcs[i]];
    }
};


/**
 * Check if a packet is a valid RPC call
 */
WebsocketRpcCaller.prototype._isCall = function(packet) {
    return (typeof packet.method !== 'undefined' &&
            typeof packet.params !== 'undefined');
};


/**
 * Check if a packet is a valid RPC response
 */
WebsocketRpcCaller.prototype._isResponse = function(packet) {
    return (typeof packet.id !== 'undefined' &&
            typeof packet.response !== 'undefined');
};



/**
 * Make an RPC call
 * First argument must be the method name to call
 * If the last argument is a function, it is used as a callback
 * All other arguments are passed to the RPC method
 * Eg. Rpc.makeCall('namespace.method_name', 1, 2, 3, callbackFn)
 */
WebsocketRpcCaller.prototype.makeCall = function(method) {
    var params, callback, packet;

    // Get a normal array of passed in arguments
    params = Array.prototype.slice.call(arguments, 1, arguments.length);

    // If the last argument is a function, take it as a callback and strip it out
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
        this._rpc_callbacks[packet.id] = callback;
    }

    this.send(packet);
};


/**
 * Encode the packet into JSON and send it over the websocket
 */
WebsocketRpcCaller.prototype.send = function(packet) {
    if (this._socket)
        this._socket.send(JSON.stringify(packet));
};


/**
 * Handler for the websocket `message` event
 */
WebsocketRpcCaller.prototype._onMessage = function(message_raw) {
    var self = this,
        packet,
        returnFn,
        callback,
        namespace, namespaces, idx;

    try {
        packet = JSON.parse(message_raw);
        if (!packet) throw 'Corrupt packet';
    } catch(err) {
        return;
    }

    if (this._isResponse(packet)) {
        // If we have no callback waiting for this response, don't do anything
        if (typeof this._rpc_callbacks[packet.id] !== 'function')
            return;

        // Delete the callback before calling it. If any exceptions accur within the callback
        // we don't have to worry about the delete not happening
        callback = this._rpc_callbacks[packet.id];
        delete this._rpc_callbacks[packet.id];

        callback.apply(this, packet.response);

    } else if (this._isCall(packet)) {
        // Calls with an ID may be responded to
        if (typeof packet.id !== 'undefined') {
            returnFn = this._createReturnCallFn(packet.id);
        } else {
            returnFn = this._noop;
        }

        this.emit.apply(this, ['all', packet.method, returnFn].concat(packet.params));
        this.emit.apply(this, [packet.method, returnFn].concat(packet.params));

        if (packet.method.indexOf('.') > 0) {
            namespace = packet.method.substring(0, packet.method.lastIndexOf('.'));
            namespaces = this._findRelevantNamespaces(namespace);
            for(idx in namespaces){
                packet.method = packet.method.replace(namespaces[idx]._namespace + '.', '');
                namespaces[idx].emit.apply(namespaces[idx], [packet.method, returnFn].concat(packet.params));
            }
        }
    }
};


/**
 * Returns a function used as a callback when responding to a call
 */
WebsocketRpcCaller.prototype._createReturnCallFn = function(packet_id) {
    var self = this;

    return function returnCallFn() {
        var value = Array.prototype.slice.call(arguments, 0);

        var ret_packet = {
            id: packet_id,
            response: value
        };

        self.send(ret_packet);
    };
};



WebsocketRpcCaller.prototype._noop = function() {};



WebsocketRpcCaller.prototype.Namespace = function(rpc, namespace) {
    var ret = function WebsocketRpcNamespaceInstance() {
        if (typeof arguments[0] === 'undefined') {
            return;
        }

        arguments[0] = ret._namespace + '.' + arguments[0];
        return ret._rpc.apply(ret._rpc, arguments);
    };

    ret._rpc = rpc;
    ret._namespace = namespace;

    ret.dispose = function() {
        ret.removeAllListeners();
        ret._rpc = null;
    };

    rpc._mixinEmitter(ret);

    return ret;
};




// If running a node module, set the exports
if (typeof module === 'object' && typeof module.exports !== 'undefined') {
    module.exports = WebsocketRpc;
}

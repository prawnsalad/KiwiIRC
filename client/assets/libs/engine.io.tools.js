var EngineioTools = {
    ReconnectingSocket: function ReconnectingSocket(server_uri, socket_options) {
        var connected = false;
        var is_reconnecting = false;

        var reconnect_delay = 2000;
        var reconnect_last_delay = 0;
        var reconnect_delay_exponential = true;
        var reconnect_max_attempts = 5;
        var reconnect_step = 0;
        var reconnect_tmr = null;

        var original_disconnect;
        var planned_disconnect = false;

        var socket = eio.apply(eio, arguments);
        socket.on('open', onOpen);
        socket.on('close', onClose);
        socket.on('error', onError);

        original_disconnect = socket.close;
        socket.close = close;

        // Apply any custom reconnection config
        if (socket_options) {
            if (typeof socket_options.reconnect_delay === 'number')
                reconnect_delay = socket_options.reconnect_delay;

            if (typeof socket_options.reconnect_max_attempts === 'number')
                reconnect_max_attempts = socket_options.reconnect_max_attempts;

            if (typeof socket_options.reconnect_delay_exponential !== 'undefined')
                reconnect_delay_exponential = !!socket_options.reconnect_delay_exponential;
        }


        function onOpen() {
            connected = true;
            is_reconnecting = false;
            planned_disconnect = false;

            reconnect_step = 0;
            reconnect_last_delay = 0;

            clearTimeout(reconnect_tmr);
        }


        function onClose() {
            connected = false;

            if (!planned_disconnect)
                reconnect();
        }


        function onError() {
            // This will be called when a reconnect fails
            if (is_reconnecting)
                reconnect();
        }


        function close() {
            planned_disconnect = true;
            original_disconnect.call(socket);
        }


        function reconnect() {
            if (reconnect_step >= reconnect_max_attempts) {
                socket.emit('reconnecting_failed');
                return;
            }

            var delay = reconnect_delay_exponential ?
                (reconnect_last_delay || reconnect_delay / 2) * 2 :
                reconnect_delay * reconnect_step;

            is_reconnecting = true;

            reconnect_tmr = setTimeout(function() {
                socket.open();
            }, delay);

            reconnect_last_delay = delay;

            socket.emit('reconnecting', {
                attempt: reconnect_step + 1,
                max_attempts: reconnect_max_attempts,
                delay: delay
            });

            reconnect_step++;
        }

        return socket;
    },




    Rpc: (function(){
        /*
            TODO:
            Create a document explaining the protocol
            Some way to expire unused callbacks? TTL? expireCallback() function?
        */

        function WebsocketRpc(eio_socket) {
            var self = this;

            this._next_id = 0;
            this._rpc_callbacks = {};
            this._socket = eio_socket;

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
                this._socket.removeListener('message', this._onMessageProxy);
                delete this._onMessageProxy;
            }

            this.removeAllListeners();
        };




        /**
         * The engine.io socket already has an emitter mixin so steal it from there
         */
        WebsocketRpc.prototype._mixinEmitter = function() {
            var funcs = ['on', 'once', 'off', 'removeListener', 'removeAllListeners', 'emit', 'listeners', 'hasListeners'];

            for (var i=0; i<funcs.length; i++) {
                if (typeof this._socket[funcs[i]] === 'function')
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



        /**
         * Make an RPC call
         * First argument must be the method name to call
         * If the last argument is a function, it is used as a callback
         * All other arguments are passed to the RPC method
         * Eg. Rpc.call('namespace.method_name', 1, 2, 3, callbackFn)
         */
        WebsocketRpc.prototype.call = function(method) {
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
                returnFn,
                callback;

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

                this.emit.apply(this, [packet.method, returnFn].concat(packet.params));
            }
        };


        /**
         * Returns a function used as a callback when responding to a call
         */
        WebsocketRpc.prototype._createReturnCallFn = function(packet_id) {
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



        WebsocketRpc.prototype._noop = function() {};


        return WebsocketRpc;

    }())
};

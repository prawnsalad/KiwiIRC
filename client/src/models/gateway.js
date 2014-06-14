_kiwi.model.Gateway = function () {

    // Set to a reference to this object within initialize()
    var that = null;

    this.initialize = function () {
        that = this;

        // For ease of access. The socket.io object
        this.socket = this.get('socket');

        // Used to check if a disconnection was unplanned
        this.disconnect_requested = false;

        this.session = new _kiwi.model.Session();
    };



    this.reconnect = function (callback) {
        var that = this,
            transport_path;

        this.disconnect_requested = true;
        this.socket.close();

        this.socket = null;
        this.connect(callback);
    };



    /**
    *   Connects to the server
    *   @param  {Function}  callback    A callback function to be invoked once Kiwi's server has connected to the IRC server
    */
    this.connect = function (callback) {
        this.connect_callback = callback;

        // Keep note of the server we are connecting to
        this.set('kiwi_server', _kiwi.app.kiwi_server);

        this.socket = new EngineioTools.ReconnectingSocket(this.get('kiwi_server'), {
            transports: _kiwi.app.server_settings.transports || ['websocket', 'polling'],
            path: _kiwi.app.get('base_path') + '/transport',
            reconnect_max_attempts: 5,
            reconnect_delay: 2000
        });

        this.rpc = new EngineioTools.Rpc(this.socket);

        this.socket.on('connect_failed', function (reason) {
            this.socket.disconnect();
            this.trigger("connect_fail", {reason: reason});
        });

        this.socket.on('error', function (e) {
            console.log("_kiwi.gateway.socket.on('error')", {reason: e});
            if (that.connect_callback) {
                that.connect_callback(e);
                delete that.connect_callback;
            }

            that.trigger("connect_fail", {reason: e});
        });

        this.socket.on('connecting', function (transport_type) {
            console.log("_kiwi.gateway.socket.on('connecting')");
            that.trigger("connecting");
        });

        /**
         * Once connected to the kiwi server send the IRC connect command along
         * with the IRC server details.
         * A `connect` event is sent from the kiwi server once connected to the
         * IRCD and the nick has been accepted.
         */
        this.socket.on('open', function () {
            // Reset the disconnect_requested flag
            that.disconnect_requested = false;

            console.log("_kiwi.gateway.socket.on('open')");
        });

        this.rpc.on('too_many_connections', function () {
            that.trigger("connect_fail", {reason: 'too_many_connections'});
        });

        this.rpc.on('irc', function (response, data) {
            that.parse(data.command, data.data);
        });

        this.rpc.on('kiwi', function (response, data) {
            that.parseKiwi(data.command, data.data);
        });

        this.socket.on('close', function () {
            that.trigger("disconnect", {});
            console.log("_kiwi.gateway.socket.on('close')");
        });

        this.socket.on('reconnecting', function (status) {
            console.log("_kiwi.gateway.socket.on('reconnecting')");
            that.trigger("reconnecting", {delay: status.delay, attempts: status.attempts});
        });

        this.socket.on('reconnecting_failed', function () {
            console.log("_kiwi.gateway.socket.on('reconnect_failed')");
        });
    };



    /**
     * Return a new network object with the new connection details
     */
    this.newConnection = function(connection_info, callback_fn) {
        var that = this;

        // If not connected, connect first then re-call this function
        if (!this.isConnected()) {
            this.connect(function(err) {
                if (err) {
                    callback_fn(err);
                    return;
                }

                that.newConnection(connection_info, callback_fn);
            });

            return;
        }

        this.makeIrcConnection(connection_info, function(err, server_num) {
            var connection;

            if (!err) {
                if (!_kiwi.app.connections.getByConnectionId(server_num)){
                    var inf = {
                        connection_id: server_num,
                        nick: connection_info.nick,
                        address: connection_info.host,
                        port: connection_info.port,
                        ssl: connection_info.ssl,
                        password: connection_info.password
                    };
                    connection = new _kiwi.model.Network(inf);
                    _kiwi.app.connections.add(connection);
                }

                console.log("_kiwi.gateway.socket.on('connect')", connection);
                callback_fn && callback_fn(err, connection);

            } else {
                console.log("_kiwi.gateway.socket.on('error')", {reason: err});
                callback_fn && callback_fn(err);
            }
        });
    };


    /**
     * Make a new IRC connection and return its connection ID
     */
    this.makeIrcConnection = function(connection_info, callback_fn) {
        var server_info = {
            nick:       connection_info.nick,
            hostname:   connection_info.host,
            port:       connection_info.port,
            ssl:        connection_info.ssl,
            password:   connection_info.password
        };

        connection_info.options = connection_info.options || {};

        // A few optional parameters
        if (connection_info.options.encoding)
            server_info.encoding = connection_info.options.encoding;

        this.rpc.call('kiwi.connect_irc', server_info, function (err, server_num) {
            if (!err) {
                callback_fn && callback_fn(err, server_num);

            } else {
                callback_fn && callback_fn(err);
            }
        });
    };


    this.isConnected = function () {
        // TODO: Check this. Might want to use .readyState
        return this.socket;
    };



    this.parseKiwi = function (command, data) {
        var that = this,
            client_info_data, args;

        switch (command) {
        case 'connected':
            // Send some info on this client to the server
            args = {
                build_version: _kiwi.global.build_version
            };
            this.rpc.call('kiwi.client_info', args);

            this.connect_callback && this.connect_callback();
            delete this.connect_callback;

            break;
        }

        this.trigger('kiwi:' + command, data);
        this.trigger('kiwi', data);
    };

    /**
    *   Parses the response from the server
    */
    this.parse = function (command, data) {

        // Trigger the connection specific events (used by Network objects)
        if (typeof data.connection_id !== 'undefined') {
            that.trigger('connection:' + data.connection_id.toString(), {
                event_name: command,
                event_data: data
            });

            // Some events trigger a more in-depth event name
            if (command == 'message' && data.type) {
                that.trigger('connection:' + data.connection_id.toString(), {
                    event_name: 'message:' + data.type,
                    event_data: data
                });
            }

            if (command == 'channel' && data.type) {
                that.trigger('connection:' + data.connection_id.toString(), {
                    event_name: 'channel:' + data.type,
                    event_data: data
                });
            }
        }

        // Trigger the global events
        that.trigger(command, data);
    };

    this.rpcCall = function(method, connection_id) {
        var args = Array.prototype.slice.call(arguments, 0);

        if (typeof args[1] === 'undefined' || args[1] === null)
            args[1] = _kiwi.app.connections.active_connection.get('connection_id');

        return this.rpc.call.apply(this.rpc, args);
    };

    /**
    *   Sends a PRIVMSG message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.privmsg = function (connection_id, target, msg, callback) {
        var args = {
            target: target,
            msg: msg
        };

        this.rpcCall('irc.privmsg', connection_id, args, callback);
    };

    /**
    *   Sends a NOTICE message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.notice = function (connection_id, target, msg, callback) {
        var args = {
            target: target,
            msg: msg
        };

        this.rpcCall('irc.notice', connection_id, args, callback);
    };

    /**
    *   Sends a CTCP message
    *   @param  {Boolean}   request     Indicates whether this is a CTCP request (true) or reply (false)
    *   @param  {String}    type        The type of CTCP message, e.g. 'VERSION', 'TIME', 'PING' etc.
    *   @param  {String}    target      The target of the message, e.g a channel or nick
    *   @param  {String}    params      Additional paramaters
    *   @param  {Function}  callback    A callback function
    */
    this.ctcp = function (connection_id, is_request, type, target, params, callback) {
        var args = {
            is_request: is_request,
            type: type,
            target: target,
            params: params
        };

        this.rpcCall('irc.ctcp', connection_id, args, callback);
    };

    this.ctcpRequest = function (connection_id, type, target, params, callback) {
        this.ctcp(connection_id, true, type, target, params, callback);
    };
    this.ctcpResponse = function (connection_id, type, target, params, callback) {
        this.ctcp(connection_id, false, type, target, params, callback);
    };

    /**
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.action = function (connection_id, target, msg, callback) {
        this.ctcp(connection_id, true, 'ACTION', target, msg, callback);
    };

    /**
    *   Joins a channel
    *   @param  {String}    channel     The channel to join
    *   @param  {String}    key         The key to the channel
    *   @param  {Function}  callback    A callback function
    */
    this.join = function (connection_id, channel, key, callback) {
        var args = {
            channel: channel,
            key: key
        };

        this.rpcCall('irc.join', connection_id, args, callback);
    };

    /**
    *   Retrieves channel information
    */
    this.channelInfo = function (connection_id, channel, callback) {
        var args = {
            channel: channel
        };

        this.rpcCall('irc.channel_info', connection_id, args, callback);
    };

    /**
    *   Leaves a channel
    *   @param  {String}    channel     The channel to part
    *   @param  {String}    message     Optional part message
    *   @param  {Function}  callback    A callback function
    */
    this.part = function (connection_id, channel, message, callback) {
        "use strict";

        // The message param is optional, so juggle args if it is missing
        if (typeof arguments[2] === 'function') {
            callback = arguments[2];
            message = undefined;
        }
        var args = {
            channel: channel,
            message: message
        };

        this.rpcCall('irc.part', connection_id, args, callback);
    };

    /**
    *   Queries or modifies a channell topic
    *   @param  {String}    channel     The channel to query or modify
    *   @param  {String}    new_topic   The new topic to set
    *   @param  {Function}  callback    A callback function
    */
    this.topic = function (connection_id, channel, new_topic, callback) {
        var args = {
            channel: channel,
            topic: new_topic
        };

        this.rpcCall('irc.topic', connection_id, args, callback);
    };

    /**
    *   Kicks a user from a channel
    *   @param  {String}    channel     The channel to kick the user from
    *   @param  {String}    nick        The nick of the user to kick
    *   @param  {String}    reason      The reason for kicking the user
    *   @param  {Function}  callback    A callback function
    */
    this.kick = function (connection_id, channel, nick, reason, callback) {
        var args = {
            channel: channel,
            nick: nick,
            reason: reason
        };

        this.rpcCall('irc.kick', connection_id, args, callback);
    };

    /**
    *   Disconnects us from the server
    *   @param  {String}    msg         The quit message to send to the IRC server
    *   @param  {Function}   callback    A callback function
    */
    this.quit = function (connection_id, msg, callback) {
        msg = msg || "";

        var args = {
            message: msg
        };

        this.rpcCall('irc.quit', connection_id, args, callback);
    };

    /**
    *   Sends a string unmodified to the IRC server
    *   @param  {String}    data        The data to send to the IRC server
    *   @param  {Function}  callback    A callback function
    */
    this.raw = function (connection_id, data, callback) {
        var args = {
            data: data
        };

        this.rpcCall('irc.raw', connection_id, args, callback);
    };

    /**
    *   Changes our nickname
    *   @param  {String}    new_nick    Our new nickname
    *   @param  {Function}  callback    A callback function
    */
    this.changeNick = function (connection_id, new_nick, callback) {
        var args = {
            nick: new_nick
        };

        this.rpcCall('irc.nick', connection_id, args, callback);
    };

    /**
    * Sets a mode for a target
    */
    this.mode = function (connection_id, target, mode_string, callback) {
        var args = {
            data: 'MODE ' + target + ' ' + mode_string
        };

        this.rpcCall('irc.raw', connection_id, args, callback);
    };

    /**
     *  Sends ENCODING change request to server.
     *  @param  {String}     new_encoding  The new proposed encode
     *  @param  {Fucntion}   callback      A callback function
     */
    this.setEncoding = function (connection_id, new_encoding, callback) {
        var args = {
            encoding: new_encoding
        };

        this.rpcCall('irc.encoding', connection_id, args, callback);
    };


    return new (Backbone.Model.extend(this))(arguments);
};

_kiwi.model.Gateway = function () {

    // Set to a reference to this object within initialize()
    var that = null;

    this.initialize = function () {
        that = this;

        // For ease of access. The socket.io object
        this.socket = this.get('socket');

        this.applyEventHandlers();

        // Used to check if a disconnection was unplanned
        this.disconnect_requested = false;
    };


    this.applyEventHandlers = function () {
        /*
        kiwi.gateway.on('message:#channel', my_function);
        kiwi.gateway.on('message:somenick', my_function);

        kiwi.gateway.on('notice:#channel', my_function);
        kiwi.gateway.on('action:somenick', my_function);

        kiwi.gateway.on('join:#channel', my_function);
        kiwi.gateway.on('part:#channel', my_function);
        kiwi.gateway.on('quit', my_function);
        */
        var that = this;

        // Some easier handler events
        this.on('onmsg', function (event) {
            var source,
                connection = _kiwi.app.connections.getByConnectionId(event.server),
                is_pm = (event.channel.toLowerCase() == connection.get('nick').toLowerCase());

            source = is_pm ? event.nick : event.channel;

            that.trigger('message:' + source, event);
            that.trigger('message', event);

            if (is_pm) {
                that.trigger('pm:' + source, event);
                that.trigger('pm', event);
            }
        }, this);


        this.on('onnotice', function (event) {
            // The notice towards a channel or a query window?
            var source = event.target || event.nick;

            this.trigger('notice:' + source, event);
            this.trigger('notice', event);
        }, this);


        this.on('onaction', function (event) {
            var source,
                connection = _kiwi.app.connections.getByConnectionId(event.server),
                is_pm = (event.channel.toLowerCase() == connection.get('nick').toLowerCase());

            source = is_pm ? event.nick : event.channel;

            that.trigger('action:' + source, event);

            if (is_pm) {
                that.trigger('action:' + source, event);
                that.trigger('action', event);
            }
        }, this);


        this.on('ontopic', function (event) {
            that.trigger('topic:' + event.channel, event);
            that.trigger('topic', event);
        });


        this.on('onjoin', function (event) {
            that.trigger('join:' + event.channel, event);
            that.trigger('join', event);
        });

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


    this.resumeSession = function(username, password, callback) {
        var fn = function() {
            _kiwi.gateway.rpc.call('kiwi', {
                command: 'session_resume',
                username: username,
                password: password,
            }, callback);
        };

        if (this.isConnected()) {
            fn();
        } else {
            this.connect(fn);
        }
    };


    this.saveSession = function(username, password, callback) {
        _kiwi.gateway.rpc.call('kiwi', {
            command: 'session_save',
            username: username,
            password: password,
        }, callback);
    };


    this.syncSessionEvents = function(network_id, target, callback) {
        if (target && !callback) {
            callback = target;
            target = undefined;
        }

        _kiwi.gateway.rpc.call('kiwi', {
            command: 'session_events',
            connection_id: network_id,
            target: target,
        }, callback);
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
            command:    'connect',
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

        this.rpc.call('kiwi', server_info, function (err, server_num) {
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
            client_info_data;

        this.trigger('kiwi:' + command, data);
        this.trigger('kiwi', data);

        switch (command) {
        case 'connection_sync':
            _.each(data, function(connection) {
                console.log(connection);
                var new_connection,
                    inf = {
                        connection_id: connection.connection_id,
                        nick: connection.nick,
                        address: connection.host,
                        port: connection.port,
                        ssl: connection.ssl
                    };

                new_connection = new _kiwi.model.Network(inf);
                that.trigger('connection:' + connection.connection_id.toString(), {
                    event_name: 'options',
                    event_data: {options: connection.options.options, cap: connection.options.cap}
                });
                //new_connection.parseOptions(connection.options.options, connection.options.cap);

                _kiwi.app.connections.add(new_connection);

                _.each(connection.channels, function(channel_info, idx) {
                    var channel = new_connection.panels.getByName(channel_info.name);

                    if (!channel) {
                        channel = new _kiwi.model.Channel({name: channel_info.name, network: new_connection});
                        new_connection.panels.add(channel);
                    }
                });

                // Let the application know we have connected to an IRCd
                that.trigger('onconnect', {
                    server: connection.connection_id,
                    nick: connection.nick
                });
            });

            break;

        case 'connected':
            // Send some info on this client to the server
            client_info_data = {
                command: 'client_info',
                build_version: _kiwi.global.build_version
            };
            this.rpc.call('kiwi', client_info_data);

            this.connect_callback && this.connect_callback();
            delete this.connect_callback;

            break;
        }
    };
    /*
        Events:
            msg
            action
            server_connect
            options
            motd
            notice
            userlist
            nick
            join
            topic
            part
            kick
            quit
            whois
            syncchannel_redirect
            debug
    */
    /**
    *   Parses the response from the server
    */
    this.parse = function (command, data) {
        //console.log('gateway event', command, data);

        if (command !== undefined) {
            switch (command) {
            case 'options':
                $.each(data.options, function (name, value) {
                    switch (name) {
                    case 'CHANTYPES':
                        that.set('channel_prefix', value.join(''));
                        break;
                    case 'NETWORK':
                        that.set('name', value);
                        break;
                    case 'PREFIX':
                        that.set('user_prefixes', value);
                        break;
                    }
                });
                that.set('cap', data.cap);
                break;

            /*
            case 'sync':
                if (_kiwi.gateway.onSync && _kiwi.gateway.syncing) {
                    _kiwi.gateway.syncing = false;
                    _kiwi.gateway.onSync(item);
                }
                break;
            */

            case 'kiwi':
                this.emit('_kiwi.' + data.namespace, data.data);
                break;
            }
        }


        if (typeof data.server !== 'undefined') {
            that.trigger('connection:' + data.server.toString(), {
                event_name: command,
                event_data: data
            });
        }

        // Trigger the global events (Mainly legacy now)
        that.trigger('on' + command, data);
    };

    /**
    *   Sends data to the server
    *   @private
    *   @param  {Object}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    this.sendData = function (connection_id, data, callback) {
        if (typeof connection_id === 'undefined' || connection_id === null)
            connection_id = _kiwi.app.connections.active_connection.get('connection_id');

        var data_buffer = {
            server: connection_id,
            data: JSON.stringify(data)
        };
        this.rpc.call('irc', data_buffer, callback);
    };

    /**
    *   Sends a PRIVMSG message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.privmsg = function (connection_id, target, msg, callback) {
        var data = {
            method: 'privmsg',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Sends a NOTICE message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.notice = function (connection_id, target, msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Sends a CTCP message
    *   @param  {Boolean}   request     Indicates whether this is a CTCP request (true) or reply (false)
    *   @param  {String}    type        The type of CTCP message, e.g. 'VERSION', 'TIME', 'PING' etc.
    *   @param  {String}    target      The target of the message, e.g a channel or nick
    *   @param  {String}    params      Additional paramaters
    *   @param  {Function}  callback    A callback function
    */
    this.ctcp = function (connection_id, request, type, target, params, callback) {
        var data = {
            method: 'ctcp',
            args: {
                request: request,
                type: type,
                target: target,
                params: params
            }
        };

        this.sendData(connection_id, data, callback);
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
        var data = {
            method: 'join',
            args: {
                channel: channel,
                key: key
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Retrieves channel information
    */
    this.channelInfo = function (connection_id, channel, callback) {
        var data = {
            method: 'channel_info',
            args: {
                channel: channel
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Leaves a channel
    *   @param  {String}    channel     The channel to part
    *   @param  {Function}  callback    A callback function
    */
    this.part = function (connection_id, channel, callback) {
        var data = {
            method: 'part',
            args: {
                channel: channel
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Queries or modifies a channell topic
    *   @param  {String}    channel     The channel to query or modify
    *   @param  {String}    new_topic   The new topic to set
    *   @param  {Function}  callback    A callback function
    */
    this.topic = function (connection_id, channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: channel,
                topic: new_topic
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Kicks a user from a channel
    *   @param  {String}    channel     The channel to kick the user from
    *   @param  {String}    nick        The nick of the user to kick
    *   @param  {String}    reason      The reason for kicking the user
    *   @param  {Function}  callback    A callback function
    */
    this.kick = function (connection_id, channel, nick, reason, callback) {
        var data = {
            method: 'kick',
            args: {
                channel: channel,
                nick: nick,
                reason: reason
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Disconnects us from the server
    *   @param  {String}    msg         The quit message to send to the IRC server
    *   @param  {Function}   callback    A callback function
    */
    this.quit = function (connection_id, msg, callback) {
        msg = msg || "";
        var data = {
            method: 'quit',
            args: {
                message: msg
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Sends a string unmodified to the IRC server
    *   @param  {String}    data        The data to send to the IRC server
    *   @param  {Function}  callback    A callback function
    */
    this.raw = function (connection_id, data, callback) {
        data = {
            method: 'raw',
            args: {
                data: data
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    *   Changes our nickname
    *   @param  {String}    new_nick    Our new nickname
    *   @param  {Function}  callback    A callback function
    */
    this.changeNick = function (connection_id, new_nick, callback) {
        var data = {
            method: 'nick',
            args: {
                nick: new_nick
            }
        };

        this.sendData(connection_id, data, callback);
    };

    /**
    * Sets a mode for a target
    */
    this.mode = function (connection_id, target, mode_string, callback) {
        data = {
            method: 'raw',
            args: {
                data: 'MODE ' + target + ' ' + mode_string
            }
        };

        this.sendData(connection_id, data, callback);
    };


    /**
     *  Sends ENCODING change request to server.
     *  @param  {String}     new_encoding  The new proposed encode
     *  @param  {Fucntion}   callback      A callback function
     */
    this.setEncoding = function (connection_id, new_encoding, callback) {
        var data = {
            method: 'encoding',
            args: {
                encoding: new_encoding
            }
        };
        this.sendData(connection_id, data, callback);
    };

    /**
    *   Sends data to a fellow Kiwi IRC user
    *   @param  {String}    target      The nick of the Kiwi IRC user to send to
    *   @param  {String}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    this.kiwi = function (target, data, callback) {
        data = {
            method: 'kiwi',
            args: {
                target: target,
                data: data
            }
        };

        this.sendData(data, callback);
    };


    return new (Backbone.Model.extend(this))(arguments);
};

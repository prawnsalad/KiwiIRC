_kiwi.model.Gateway = function () {

    // Set to a reference to this object within initialize()
    var that = null;

    this.defaults = {
        /**
        *   The name of the network
        *   @type    String
        */
        name: 'Server',

        /**
        *   The address (URL) of the network
        *   @type    String
        */
        address: '',

        /**
        *   The current nickname
        *   @type   String
        */
        nick: '',

        /**
        *   The channel prefix for this network
        *   @type    String
        */
        channel_prefix: '#',

        /**
        *   The user prefixes for channel owner/admin/op/voice etc. on this network
        *   @type   Array
        */
        user_prefixes: ['~', '&', '@', '+'],

        /**
        *   The URL to the Kiwi server
        *   @type   String
        */
        kiwi_server: '//kiwi',

        /**
        *   List of nicks we are ignoring
        *   @type Array
        */
        ignore_list: []
    };


    this.initialize = function () {
        that = this;
        
        // For ease of access. The socket.io object
        this.socket = this.get('socket');

        this.applyEventHandlers();
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
                is_pm = (event.channel == that.get('nick'));

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
                is_pm = (event.channel == that.get('nick'));

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



    /**
    *   Connects to the server
    *   @param  {String}    host        The hostname or IP address of the IRC server to connect to
    *   @param  {Number}    port        The port of the IRC server to connect to
    *   @param  {Boolean}   ssl         Whether or not to connect to the IRC server using SSL
    *   @param  {String}    password    The password to supply to the IRC server during registration
    *   @param  {Function}  callback    A callback function to be invoked once Kiwi's server has connected to the IRC server
    */
    this.connect = function (host, port, ssl, password, callback) {
        var resource;

        // Work out the resource URL for socket.io
        if (_kiwi.app.get('base_path').substr(0, 1) === '/') {
            resource = _kiwi.app.get('base_path');
            resource = resource.substr(1, resource.length-1);
            resource += '/transport';
        } else {
            resource = _kiwi.app.get('base_path') + '/transport';
        }

        this.socket = io.connect(this.get('kiwi_server'), {
            'resource': resource,
            
            'try multiple transports': true,
            'connect timeout': 3000,
            'max reconnection attempts': 7,
            'reconnection delay': 2000,
            'sync disconnect on unload': false
        });
        this.socket.on('connect_failed', function (reason) {
            this.socket.disconnect();
            this.trigger("connect_fail", {reason: reason});
        });

        this.socket.on('error', function (e) {
            console.log("_kiwi.gateway.socket.on('error')", {reason: e});
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
        this.socket.on('connect', function () {
            that.newConnection({
                nick: that.get('nick'),
                host: host,
                port: port,
                ssl: ssl,
                password: password
            }, callback);
            /*
            this.emit('kiwi', {command: 'connect', nick: that.get('nick'), hostname: host, port: port, ssl: ssl, password:password}, function (err, server_num) {
                if (!err) {
                    that.server_num = server_num;
                    console.log("_kiwi.gateway.socket.on('connect')");
                } else {
                    console.log("_kiwi.gateway.socket.on('error')", {reason: err});
                    callback(err);
                }
            });
            */
        });

        this.socket.on('too_many_connections', function () {
            that.trigger("connect_fail", {reason: 'too_many_connections'});
        });

        this.socket.on('irc', function (data, callback) {
            that.parse(data.command, data.data);
        });

        this.socket.on('kiwi', function (data, callback) {
            that.parseKiwi(data.command, data.data);
        });

        this.socket.on('disconnect', function () {
            that.trigger("disconnect", {});
            console.log("_kiwi.gateway.socket.on('disconnect')");
        });

        this.socket.on('close', function () {
            console.log("_kiwi.gateway.socket.on('close')");
        });

        this.socket.on('reconnecting', function (reconnectionDelay, reconnectionAttempts) {
            console.log("_kiwi.gateway.socket.on('reconnecting')");
            that.trigger("reconnecting", {delay: reconnectionDelay, attempts: reconnectionAttempts});
        });

        this.socket.on('reconnect_failed', function () {
            console.log("_kiwi.gateway.socket.on('reconnect_failed')");
        });
    };



    this.newConnection = function(connection_info, callback_fn) {
        var that = this,
            h = connection_info;

        this.socket.emit('kiwi', {command: 'connect', nick: h.nick, hostname: h.host, port: h.port, ssl: h.ssl, password: h.password}, function (err, server_num) {
            if (!err) {
                // TODO: Remove this whole premature connection thing when panel code is tidied
                if (server_num != 0 && !_kiwi.app.connections.getByConnectionId(server_num)){
                    _kiwi.app.connections.add(new _kiwi.model.Network({connection_id: server_num}));
                }

                console.log("_kiwi.gateway.socket.on('connect')");
                callback_fn && callback_fn(err);
                
            } else {
                console.log("_kiwi.gateway.socket.on('error')", {reason: err});
                callback_fn && callback_fn(err);
            }
        });
    };



    this.isConnected = function () {
        return this.socket.socket.connected;
    };



    this.parseKiwi = function (command, data) {
        this.trigger('kiwi:' + command, data);
        this.trigger('kiwi', data);
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
            that.trigger('on' + command, data);

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

            case 'connect':
                that.set('nick', data.nick);
                break;

            case 'nick':
                if (data.nick === that.get('nick')) {
                    that.set('nick', data.newnick);
                }
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
    };

    /**
    *   Sends data to the server
    *   @private
    *   @param  {Object}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    this.sendData = function (data, callback) {
        var data_buffer = {
            server: _kiwi.app.connections.active_connection.get('connection_id'),
            data: JSON.stringify(data)
        };
        
        this.socket.emit('irc', data_buffer, callback);
    };

    /**
    *   Sends a PRIVMSG message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.privmsg = function (target, msg, callback) {
        var data = {
            method: 'privmsg',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a NOTICE message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.notice = function (target, msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a CTCP message
    *   @param  {Boolean}   request     Indicates whether this is a CTCP request (true) or reply (false)
    *   @param  {String}    type        The type of CTCP message, e.g. 'VERSION', 'TIME', 'PING' etc.
    *   @param  {String}    target      The target of the message, e.g a channel or nick
    *   @param  {String}    params      Additional paramaters
    *   @param  {Function}  callback    A callback function
    */
    this.ctcp = function (request, type, target, params, callback) {
        var data = {
            method: 'ctcp',
            args: {
                request: request,
                type: type,
                target: target,
                params: params
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.action = function (target, msg, callback) {
        this.ctcp(true, 'ACTION', target, msg, callback);
    };

    /**
    *   Joins a channel
    *   @param  {String}    channel     The channel to join
    *   @param  {String}    key         The key to the channel
    *   @param  {Function}  callback    A callback function
    */
    this.join = function (channel, key, callback) {
        var data = {
            method: 'join',
            args: {
                channel: channel,
                key: key
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Leaves a channel
    *   @param  {String}    channel     The channel to part
    *   @param  {Function}  callback    A callback function
    */
    this.part = function (channel, callback) {
        var data = {
            method: 'part',
            args: {
                channel: channel
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Queries or modifies a channell topic
    *   @param  {String}    channel     The channel to query or modify
    *   @param  {String}    new_topic   The new topic to set
    *   @param  {Function}  callback    A callback function
    */
    this.topic = function (channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: channel,
                topic: new_topic
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Kicks a user from a channel
    *   @param  {String}    channel     The channel to kick the user from
    *   @param  {String}    nick        The nick of the user to kick
    *   @param  {String}    reason      The reason for kicking the user
    *   @param  {Function}  callback    A callback function
    */
    this.kick = function (channel, nick, reason, callback) {
        var data = {
            method: 'kick',
            args: {
                channel: channel,
                nick: nick,
                reason: reason
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Disconnects us from the server
    *   @param  {String}    msg         The quit message to send to the IRC server
    *   @param  {Function}   callback    A callback function
    */
    this.quit = function (msg, callback) {
        msg = msg || "";
        var data = {
            method: 'quit',
            args: {
                message: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a string unmodified to the IRC server
    *   @param  {String}    data        The data to send to the IRC server
    *   @param  {Function}  callback    A callback function
    */
    this.raw = function (data, callback) {
        data = {
            method: 'raw',
            args: {
                data: data
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Changes our nickname
    *   @param  {String}    new_nick    Our new nickname
    *   @param  {Function}  callback    A callback function
    */
    this.changeNick = function (new_nick, callback) {
        var data = {
            method: 'nick',
            args: {
                nick: new_nick
            }
        };

        this.sendData(data, callback);
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


    // Check a nick alongside our ignore list
    this.isNickIgnored = function (nick) {
        var idx, list = this.get('ignore_list');
        var pattern, regex;

        for (idx = 0; idx < list.length; idx++) {
            pattern = list[idx].replace(/([.+^$[\]\\(){}|-])/g, "\\$1")
                .replace('*', '.*')
                .replace('?', '.');

            regex = new RegExp(pattern, 'i');
            if (regex.test(nick)) return true;
        }

        return false;
    }


    return new (Backbone.Model.extend(this))(arguments);
};
/*jslint devel: true, browser: true, confusion: true, sloppy: true, maxerr: 50, indent: 4 */
/*globals io, $, kiwi, kiwi_server */
/**
    @namespace Gateway between the client and server
*/
kiwi.gateway = {
    /**
    *   The current nickname
    *   @type   String
    */
    nick: 'kiwi',
    /**
    *   The session ID
    */
    session_id: null,
    /**
    *   Whether we're syncing or not
    *   @type   Boolean
    */
    syncing: false,
    /**
    *   The channel prefix for this network
    *   @type    String
    */
    channel_prefix: '#',
    /**
    *   The name of the network
    *   @type    String
    */
    network_name: '',
    /**
    *   The user prefixes for channel owner/admin/op/voice etc. on this network
    *   @type   Array
    */
    user_prefixes: ['~', '&', '@', '+'],
    /**
    *   The Socket.IO socket
    *   @type   Object
    */
    socket: null,
    /**
    *   The location of the remote Socket.IO endpoint
    *   @type   String
    */
    kiwi_server: null,

    /**
    *   Configures {@link kiwi.gateway.kiwi_server}
    *   @param  {String}    kiwi_server The location of the remote Socket.IO endpoint
    */
    start: function (kiwi_server) {
        if (typeof kiwi_server !== 'undefined') {
            kiwi.gateway.kiwi_server = kiwi_server;
        }
    },

    /**
    *   Connects to the server
    *   @param  {String}    host        The hostname or IP address of the IRC server to connect to
    *   @param  {Number}    port        The port of the IRC server to connect to
    *   @param  {Boolean}   ssl         Whether or not to connect to the IRC server using SSL
    *   @param  {String}    password    The password to supply to the IRC server during registration
    *   @param  {Function}  callback    A callback function to be invoked once Kiwi's server has connected to the IRC server
    */
    connect: function (host, port, ssl, password, callback) {
        if (typeof kiwi.gateway.kiwi_server !== 'undefined') {
            kiwi.gateway.socket = io.connect(kiwi.gateway.kiwi_server, {
                'try multiple transports': true,
                'connect timeout': 3000,
                'max reconnection attempts': 7,
                'reconnection delay': 2000
            });
            kiwi.gateway.socket.on('connect_failed', function (reason) {
                // TODO: When does this even actually get fired? I can't find a case! ~Darren
                console.debug('Unable to connect Socket.IO', reason);
                console.log("kiwi.gateway.socket.on('connect_failed')");
                //kiwi.front.tabviews.server.addMsg(null, ' ', 'Unable to connect to Kiwi IRC.\n' + reason, 'error');
                kiwi.gateway.socket.disconnect();
                $(kiwi.gateway).trigger("onconnect_fail", {reason: reason});
                kiwi.gateway.sendData = function () {};
            }).on('error', function (e) {
                $(kiwi.gateway).trigger("onconnect_fail", {reason: e});
                console.log("kiwi.gateway.socket.on('error')");
                console.log(e);
            });

            kiwi.gateway.socket.on('connecting', function (transport_type) {
                console.log("kiwi.gateway.socket.on('connecting')");
                $(kiwi.gateway).trigger("connecting");
            });

            kiwi.gateway.socket.on('connect', function () {
                // This is also called when reconnected..
                kiwi.gateway.sendData = function (data, callback) {
                    kiwi.gateway.socket.emit('message', {sid: this.session_id, data: $.toJSON(data)}, callback);
                };

                kiwi.gateway.socket.emit('irc connect', kiwi.gateway.nick, host, port, ssl, password, callback);
                console.log("kiwi.gateway.socket.on('connect')");
            });
            kiwi.gateway.socket.on('too_many_connections', function () {
                $(kiwi.gateway).trigger("onconnect_fail", {reason: 'too_many_connections'});
            });

            kiwi.gateway.socket.on('message', kiwi.gateway.parse);
            kiwi.gateway.socket.on('disconnect', function () {
                // Teardown procedure here
                $(kiwi.gateway).trigger("ondisconnect", {});
                console.log("kiwi.gateway.socket.on('disconnect')");
            });
            kiwi.gateway.socket.on('close', function () {
                console.log("kiwi.gateway.socket.on('close')");
            });

            kiwi.gateway.socket.on('reconnecting', function (reconnectionDelay, reconnectionAttempts) {
                console.log("kiwi.gateway.socket.on('reconnecting')");
                $(kiwi.gateway).trigger("onreconnecting", {delay: reconnectionDelay, attempts: reconnectionAttempts});
            });
            kiwi.gateway.socket.on('reconnect_failed', function () {
                console.log("kiwi.gateway.socket.on('reconnect_failed')");
            });
        }
    },

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
    parse: function (item) {
        if (item.event !== undefined) {
            $(kiwi.gateway).trigger('on' + item.event, item);

            switch (item.event) {
            case 'options':
                $.each(item.options, function (name, value) {
                    switch (name) {
                    case 'CHANTYPES':
                        kiwi.gateway.channel_prefix = value.charAt(0);
                        break;
                    case 'NETWORK':
                        kiwi.gateway.network_name = value;
                        break;
                    case 'PREFIX':
                        kiwi.gateway.user_prefixes = value;
                        break;
                    }
                });
                break;

            case 'sync':
                if (kiwi.gateway.onSync && kiwi.gateway.syncing) {
                    kiwi.gateway.syncing = false;
                    kiwi.gateway.onSync(item);
                }
                break;

            case 'kiwi':
                $(kiwi.gateway).trigger('kiwi.' + item.namespace, item.data);
                break;
            }
        }
    },

    /**
    *   Sends data to the server
    *   @private
    *   @param  {Object}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    sendData: function (data, callback) {},

    /**
    *   Sends a PRIVMSG message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    privmsg: function (target, msg, callback) {
        var data = {
            method: 'privmsg',
            args: {
                target: target,
                msg: msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Sends a NOTICE message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    notice: function (target, msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: target,
                msg: msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Sends a CTCP message
    *   @param  {Boolean}   request     Indicates whether this is a CTCP request (true) or reply (false)
    *   @param  {String}    type        The type of CTCP message, e.g. 'VERSION', 'TIME', 'PING' etc.
    *   @param  {String}    target      The target of the message, e.g a channel or nick
    *   @param  {String}    params      Additional paramaters
    *   @param  {Function}  callback    A callback function
    */
    ctcp: function (request, type, target, params, callback) {
        var data = {
            method: 'ctcp',
            args: {
                request: request,
                type: type,
                target: target,
                params: params,
            }
        };
        
        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    action: function (target, msg, callback) {
        this.ctcp(true, 'ACTION', target, msg, callback);
    },

    /**
    *   Joins a channel
    *   @param  {String}    channel     The channel to join
    *   @param  {String}    key         The key to the channel
    *   @param  {Function}  callback    A callback function
    */
    join: function (channel, key, callback) {
        var data = {
            method: 'join',
            args: {
                channel: channel,
                key: key
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Leaves a channel
    *   @param  {String}    channel     The channel to part
    *   @param  {Function}  callback    A callback function
    */
    part: function (channel, callback) {
        var data = {
            method: 'part',
            args: {
                channel: channel
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Queries or modifies a channell topic
    *   @param  {String}    channel     The channel to query or modify
    *   @param  {String}    new_topic   The new topic to set
    *   @param  {Function}  callback    A callback function
    */
    topic: function (channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: channel,
                topic: new_topic
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Kicks a user from a channel
    *   @param  {String}    channel     The channel to kick the user from
    *   @param  {String}    nick        The nick of the user to kick
    *   @param  {String}    reason      The reason for kicking the user
    *   @param  {Function}  callback    A callback function
    */
    kick: function (channel, nick, reason, callback) {
        var data = {
            method: 'kick',
            args: {
                channel: channel,
                nick: nick,
                reason: reason
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Disconnects us from the server
    *   @param  {String}    msg         The quit message to send to the IRC server
    *   @param  {Function}   callback    A callback function
    */
    quit: function (msg, callback) {
        msg = msg || "";
        var data = {
            method: 'quit',
            args: {
                message: msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Sends a string unmodified to the IRC server
    *   @param  {String}    data        The data to send to the IRC server
    *   @param  {Function}  callback    A callback function
    */
    raw: function (data, callback) {
        var data = {
            method: 'raw',
            args: {
                data: data
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Changes our nickname
    *   @param  {String}    new_nick    Our new nickname
    *   @param  {Function}  callback    A callback function
    */
    changeNick: function (new_nick, callback) {
        var data = {
            method: 'nick',
            args: {
                nick: new_nick
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    /**
    *   Sends data to a fellow Kiwi IRC user
    *   @param  {String}    target      The nick of the Kiwi IRC user to send to
    *   @param  {String}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    kiwi: function (target, data, callback) {
        var data = {
            method: 'kiwi',
            args: {
                target: target,
                data: data
            }
        };
        
        kiwi.gateway.sendData(data, callback);
    },
};

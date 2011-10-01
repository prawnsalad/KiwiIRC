/*jslint devel: true, browser: true, confusion: true, sloppy: true, maxerr: 50, indent: 4 */
/*globals io, $, kiwi, kiwi_server */
kiwi.gateway = {
    nick: 'kiwi',
    session_id: null,
    syncing: false,
    channel_prefix: '#',
    network_name: '',
    user_prefixes: ['~', '&', '@', '+'],
    socket: null,
    kiwi_server: null,

    start: function (kiwi_server) {
        if (typeof kiwi_server !== 'undefined') {
            kiwi.gateway.kiwi_server = kiwi_server;
        }
    },

    connect: function (host, port, ssl, password, callback) {
        if (typeof kiwi.gateway.kiwi_server !== 'undefined') {
            kiwi.gateway.socket = io.connect(kiwi_server, {
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
    parse: function (item) {
        if (item.event !== undefined) {
            $(kiwi.gateway).trigger("on" + item.event, item);

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

    sendData: function () {},

    sync: function (callback) {
        if (this.session_id === null) {
            return;
        }

        var data = {
            method: 'sync',
            args: {}
        };

        kiwi.gateway.syncing = true;
        kiwi.gateway.sendData(data, callback);
    },

    debug: function (callback) {
        var data = {
            method: 'debug',
            args: {}
        };

        kiwi.gateway.sendData(data, callback);
    },


    msg: function (s_target, s_msg, callback) {
        var data = {
            method: 'msg',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    action: function (s_target, s_msg, callback) {
        var data = {
            method: 'action',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },


    kiwi: function (s_target, s_data, callback) {
        var data = {
            method: 'kiwi',
            args: {
                target: s_target,
                data: s_data
            }
        };
        kiwi.gateway.sendData(data, callback);
    },


    notice: function (s_target, s_msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    },


    join: function (s_channel, callback) {
        var data = {
            method: 'join',
            args: {
                channel: s_channel
            }
        };

        kiwi.gateway.sendData(data, callback);
    },

    setTopic: function (s_channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: s_channel,
                topic: new_topic
            }
        };

        kiwi.gateway.sendData(data, callback);
    },


    raw: function (v_data, callback) {
        var data = {
            method: 'raw',
            args: {
                data: v_data
            }
        };

        kiwi.gateway.sendData(data, callback);
    },


    quit: function (msg, callback) {
        //alert("closing");
        msg = msg || "";
        var data = {
            method: 'quit',
            args: {
                message: msg
            }
        };

        kiwi.gateway.sendData(data, callback);
    }




};

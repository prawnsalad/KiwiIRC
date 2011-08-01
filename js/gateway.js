/*jslint browser: true, confusion: true, sloppy: true, maxerr: 50, indent: 4 */
/*globals io, $ */
var gateway = {

    revision: 16,

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
            gateway.kiwi_server = kiwi_server;
        }
    },

    connect: function (host, port, ssl, callback) {
        if (typeof gateway.kiwi_server !== 'undefined') {
            gateway.socket = io.connect(kiwi_server, {'max reconnection attempts': 3});
            gateway.socket.of('/kiwi').on('connect_failed', function (reason) {
                console.debug('Unable to connect Socket.IO', reason);
                front.tabviews.server.addMsg(null, ' ', 'Unable to connect to Kiwi IRC.\n' + reason, 'error');
                gateway.socket.disconnect();
                $(gateway).trigger("ondisconnect", {});
                gateway.sendData = function () {};
            }).on('error', function (e) {
                console.debug(e);
            });
            gateway.socket.on('connect', function () {
                gateway.sendData = function (data, callback) {
                    gateway.socket.emit('message', {sid: this.session_id, data: $.toJSON(data)}, callback);
                };
                gateway.socket.on('message', gateway.parse);
                gateway.socket.on('disconnect', function () {
                    // Teardown procedure here
                    $(gateway).trigger("ondisconnect", {});
                });
                gateway.socket.emit('irc connect', gateway.nick, host, port, ssl, callback);
            });
            gateway.socket.on('too_many_connections', function () {
                front.tabviews.server.addMsg(null, ' ', 'Unable to connect to Kiwi IRC.\nYour IP address has too many connections to Kiwi IRC', 'error');
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
            $(gateway).trigger("on" + item.event, item);
        
            switch (item.event) {
            case 'options':
                $.each(item.options, function (name, value) {
                    switch (name) {
                    case 'CHANTYPES':
                        gateway.channel_prefix = value.charAt(0);
                        break;
                    case 'NETWORK':
                        gateway.network_name = value;
                        break;
                    case 'PREFIX':
                        gateway.user_prefixes = value;
                        break;
                    }
                });
                break;
        
            case 'sync':
                if (gateway.onSync && gateway.syncing) {
                    gateway.syncing = false;
                    gateway.onSync(item);
                }
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
    
        gateway.syncing = true;
        gateway.sendData(data, callback);
    },

    debug: function (callback) {
        var data = {
            method: 'debug',
            args: {}
        };

        gateway.sendData(data, callback);
    },


    msg: function (s_target, s_msg, callback) {
        var data = {
            method: 'msg',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        gateway.sendData(data, callback);
    },

    action: function (s_target, s_msg, callback) {
        var data = {
            method: 'action',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        gateway.sendData(data, callback);
    },


    notice: function (s_target, s_msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: s_target,
                msg: s_msg
            }
        };

        gateway.sendData(data, callback);
    },


    join: function (s_channel, callback) {
        var data = {
            method: 'join',
            args: {
                channel: s_channel
            }
        };

        gateway.sendData(data, callback);
    },

    setTopic: function (s_channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: s_channel,
                topic: new_topic
            }
        };

        gateway.sendData(data, callback);
    },


    raw: function (v_data, callback) {
        var data = {
            method: 'raw',
            args: {
                data: v_data
            }
        };

        gateway.sendData(data, callback);
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
    
        gateway.sendData(data, callback);
    }




};

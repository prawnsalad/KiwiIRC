var _ = require('lodash');

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};


var handlers = {
    NOTICE: function (command) {
        var namespace,
            time,
            msg;

        // Check if we have a server-time
        time = command.getServerTime();

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP response
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ? 'user' : 'channel';
            this.emit(namespace + ' ' + command.params[0] + ' ctcp_response', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg.substring(1, msg.length - 1),
                time: time
            });
        } else {
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase() || command.params[0] === '*') ?
                'user' :
                'channel';

            this.emit(namespace + ' ' + command.params[0] + ' notice', {
                from_server: command.prefix ? true : false,
                nick: command.nick || command.prefix || undefined,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg,
                time: time
            });
        }
    },


    PRIVMSG: function (command) {
        var tmp, namespace, time, msg, version_string, client_info;

        // Check if we have a server-time
        time = command.getServerTime();

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            //CTCP request
            if (msg.substr(1, 6) === 'ACTION') {
                namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ?
                    'user ' + command.nick :
                    'channel ' + command.params[0];

                this.emit(namespace + ' action', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    msg: msg.substring(8, msg.length - 1),
                    time: time
                });

            } else if (msg.substr(1, 7) === 'VERSION') {
                // Get the version for the first connected client only
                if (this.irc_connection.state.clients[0]) {
                    client_info = this.irc_connection.state.clients[0].client_info;
                }
                version_string = global.build_version;

                // If the client build_version differs from the server, add this to the version_string
                if (client_info && client_info.build_version !== global.build_version) {
                    version_string += ', client build: ' + client_info.build_version;
                }

                version_string = 'KiwiIRC (' + version_string + ')';
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'VERSION ' + version_string + String.fromCharCode(1));

            } else if (msg.substr(1, 6) === 'SOURCE') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'SOURCE http://www.kiwiirc.com/' + String.fromCharCode(1));

            } else if (msg.substr(1, 10) === 'CLIENTINFO') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'CLIENTINFO SOURCE VERSION TIME' + String.fromCharCode(1));

            } else {
                namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ?
                    'user ' + command.nick :
                    'channel ' + command.params[0];

                this.emit(namespace + ' ctcp_request', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    type: (msg.substring(1, msg.length - 1).split(' ') || [null])[0],
                    msg: msg.substring(1, msg.length - 1),
                    time: time
                });
            }
        } else {
            // A message to a user (private message) or to a channel?
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ? 'user ' + command.nick : 'channel ' + command.params[0];
            this.emit(namespace + ' privmsg', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg,
                time: time
            });
        }
    },


    RPL_WALLOPS: function (command) {
        this.emit('user ' + this.irc_connection.nick + ' wallops', {
            from_server: false,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            msg: command.params[command.params.length - 1]
        });
    },
};
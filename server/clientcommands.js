var _ = require('lodash');




var ClientCommands = function (client) {
    this.client = client;
};
module.exports = ClientCommands;

ClientCommands.prototype.run = function (command, args, irc_connection, callback) {
    // Do we have a function to handle this command?
    if (!listeners[command.toUpperCase()]) {
        return;
    }

    return listeners[command.toUpperCase()](args, irc_connection, callback);
};




var listeners = {
    PRIVMSG: function (args, irc_connection, callback) {
        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.
        var wrap_length = 350,
            trunc_msg,
            trunc_length;
            
         if (args.target && (args.msg)) {
            trunc_length = wrap_length - args.target.length;
            // If the message is longer than wrap_length, send the message in chunks
            while (args.msg.length > trunc_length) {
                trunc_msg = args.msg.substr(0, trunc_length);
                args.msg = args.msg.substr(trunc_length - 1);
                irc_connection.write('PRIVMSG ' + args.target + ' :' + trunc_msg);
            }
            // Send the remaining text
            irc_connection.write('PRIVMSG ' + args.target + ' :' + args.msg, callback);
        }
    },
    

    CTCP: function (args, irc_connection, callback) {
        if ((args.target) && (args.type)) {
            if (args.request) {
                irc_connection.write('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
            } else {
                irc_connection.write('NOTICE ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
            }
        }
    },


    RAW: function (args, irc_connection, callback) {
        irc_connection.write(args.data, callback);
    },


    JOIN: function (args, irc_connection, callback) {
        if (args.channel) {
            channels = args.channel.split(",");
            keys = (args.key) ? args.key.split(",") : [];
            _.each(channels, function (chan, index) {
                irc_connection.write('JOIN ' + chan + ' ' + (keys[index] || ''), callback);
            });
        }
    },


    PART: function (args, irc_connection, callback) {
        if (args.channel) {
            _.each(args.channel.split(","), function (chan) {
                irc_connection.write('PART ' + chan, callback);
            });
        }
    },


    TOPIC: function (args, irc_connection, callback) {
        if (args.channel) {
            if (args.topic) {
                irc_connection.write('TOPIC ' + args.channel + ' :' + args.topic, callback);
            } else {
                irc_connection.write('TOPIC ' + args.channel, callback);
            }
        }
    },


    KICK: function (args, irc_connection, callback) {
        if ((args.channel) && (args.nick)) {
            irc_connection.write('KICK ' + args.channel + ' ' + args.nick + ':' + args.reason, callback);
        }
    },


    QUIT: function (args, irc_connection, callback) {
        websocket.ircConnection.end('QUIT :' + args.message + '\r\n');
        websocket.sentQUIT = true;
        websocket.ircConnection.destroySoon();
        websocket.disconnect();
    },


    NOTICE: function (args, irc_connection, callback) {
        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.
        var wrap_length = 350,
            trunc_msg,
            trunc_length;
            
         if (args.target && (args.msg)) {
            trunc_length = wrap_length - args.target.length;
            // If the message is longer than wrap_length, send the message in chunks
            while (args.msg.length > trunc_length) {
                trunc_msg = args.msg.substr(0, trunc_length);
                args.msg = args.msg.substr(trunc_length - 1);
                irc_connection.write('NOTICE ' + args.target + ' :' + trunc_msg);
            }
            // Send the remaining text
            irc_connection.write('NOTICE ' + args.target + ' :' + args.msg, callback);
        }
    },


    MODE: function (args, irc_connection, callback) {
        if ((args.target) && (args.mode)) {
            irc_connection.write('MODE ' + args.target + ' ' + args.mode + ' ' + args.params, callback);
        }
    },


    NICK: function (args, irc_connection, callback) {
        if (args.nick) {
            irc_connection.write('NICK ' + args.nick, callback);
        }
    },


    KIWI:  function (args, irc_connection, callback) {
        if ((args.target) && (args.data)) {
            irc_connection.write('PRIVMSG ' + args.target + ': ' + String.fromCharCode(1) + 'KIWI ' + args.data + String.fromCharCode(1), callback);
        }
    }
};

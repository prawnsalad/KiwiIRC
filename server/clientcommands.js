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

ClientCommands.prototype.addRpcEvents = function(client, rpc) {
    // Called for each RPC call
    // addRpcMethod() below prepends the incoming RPC call with the method name and
    // the listener that handles this call, and passes that argument list to moduleEventWrap().
    // This gives us the chance to wrap all calls with connection_id checks and passing
    // them off to the module system.

    var moduleEventWrap = function(rpc_method, the_fn, callback, connection_id) {
        var connection, rpc_args, fn_args;

        // Make sure we have a connection_id specified
        if (!connection_id && connection_id !== 0) {
            return callback('server not specified');

        } else if (!client.state.irc_connections[connection_id]) {
            return callback('not connected to server');
        }

        // The server this command is directed to
        connection = client.state.irc_connections[connection_id];

        // Get the arguments for the RPC call only (starts at 4)
        rpc_args = Array.prototype.slice.call(arguments, 4);

        global.modules.emit('rpc ' + rpc_method, {
            arguments: rpc_args,
            client: client,
            connection: connection
        })
        .done(function() {
            // Listeners expect arguments in a (connection, callback, args..n) format, so preppend
            // the connection + callback
            fn_args = rpc_args.slice(0);
            fn_args.unshift(connection, callback);

            the_fn.apply(client, fn_args);
        })
        .prevented(function() {
            // The RPC call was prevented from running by a module
        });
    };

    // Quick + easier way to call the above function
    var addRpcMethod = function(rpc_method, fn) {
        rpc.on(rpc_method, _.partial(moduleEventWrap, rpc_method, fn));
    };

    addRpcMethod('irc.privmsg',      listeners.privmsg);
    addRpcMethod('irc.ctcp',         listeners.ctcp);
    addRpcMethod('irc.raw',          listeners.raw);
    addRpcMethod('irc.join',         listeners.join);
    addRpcMethod('irc.channel_info', listeners.channel_info);
    addRpcMethod('irc.part',         listeners.part);
    addRpcMethod('irc.topic',        listeners.topic);
    addRpcMethod('irc.kick',         listeners.kick);
    addRpcMethod('irc.quit',         listeners.quit);
    addRpcMethod('irc.notice',       listeners.notice);
    addRpcMethod('irc.mode',         listeners.mode);
    addRpcMethod('irc.nick',         listeners.nick);
    addRpcMethod('irc.kiwi',         listeners.kiwi);
    addRpcMethod('irc.encoding',     listeners.encoding);
};




/**
 * Truncate a string into blocks of a set size
 */
function truncateString(str, block_size) {
    block_size = block_size || 350;

    var blocks = [],
        current_pos;

    for (current_pos = 0; current_pos < str.length; current_pos = current_pos + block_size) {
        blocks.push(str.substr(current_pos, block_size));
    }

    return blocks;
}




var listeners = {
    privmsg: function (irc_connection, callback, args) {
        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.
        var blocks = truncateString(args.msg, 350);

        blocks.forEach(function (block, idx) {
            // Apply the callback on the last message only
            var cb = (idx === blocks.length - 1) ?
                callback :
                undefined;

            irc_connection.write('PRIVMSG ' + args.target + ' :' + block, cb);
        });
    },


    ctcp: function (irc_connection, callback, args) {
        if ((args.target) && (args.type)) {
            if (args.is_request) {
                irc_connection.write('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
            } else {
                irc_connection.write('NOTICE ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
            }
        }
    },


    raw: function (irc_connection, callback, args) {
        irc_connection.write(args.data, callback);
    },


    join: function (irc_connection, callback, args) {
        var channels, keys;
        if (args.channel) {
            channels = args.channel.split(",");
            keys = (args.key) ? args.key.split(",") : [];
            _.each(channels, function (chan, index) {
                irc_connection.write('JOIN ' + chan + ' ' + (keys[index] || ''), callback);
            });
        }
    },


    channel_info: function (irc_connection, callback, args) {
        if (args.channel) {
            irc_connection.write('MODE ' + args.channel, callback);
        }
    },


    part: function (irc_connection, callback, args) {
        if (args.channel) {
            _.each(args.channel.split(","), function (chan) {
                irc_connection.write('PART ' + chan + (args.message ? ' :' + args.message : ''), callback);
            });
        }
    },


    topic: function (irc_connection, callback, args) {
        if (args.channel) {
            if (args.topic) {
                irc_connection.write('TOPIC ' + args.channel + ' :' + args.topic, callback);
            } else {
                irc_connection.write('TOPIC ' + args.channel, callback);
            }
        }
    },


    kick: function (irc_connection, callback, args) {
        if ((args.channel) && (args.nick)) {
            irc_connection.write('KICK ' + args.channel + ' ' + args.nick + ' :' + args.reason, callback);
        }
    },


    quit: function (irc_connection, callback, args) {
        websocket.ircConnection.end('QUIT :' + args.message + '\r\n');
        websocket.sentQUIT = true;
        websocket.ircConnection.destroySoon();
        websocket.disconnect();
    },


    notice: function (irc_connection, callback, args) {
        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.

        var blocks = truncateString(args.msg, 350);
        blocks.forEach(function (block, idx) {
            // Apply the callback on the last message only
            var cb = (idx === blocks.length - 1) ?
                callback :
                undefined;

            irc_connection.write('NOTICE ' + args.target + ' :' + block, cb);
        });
    },


    mode: function (irc_connection, callback, args) {
        if ((args.target) && (args.mode)) {
            irc_connection.write('MODE ' + args.target + ' ' + args.mode + ' ' + args.params, callback);
        }
    },


    nick: function (irc_connection, callback, args) {
        if (args.nick) {
            irc_connection.write('NICK ' + args.nick, callback);
        }
    },


    kiwi:  function (irc_connection, callback, args) {
        if ((args.target) && (args.data)) {
            irc_connection.write('PRIVMSG ' + args.target + ': ' + String.fromCharCode(1) + 'KIWI ' + args.data + String.fromCharCode(1), callback);
        }
    },

    encoding: function (irc_connection, callback, args) {
        if (args.encoding) {
            return callback(irc_connection.setEncoding(args.encoding));
        }
    }
};

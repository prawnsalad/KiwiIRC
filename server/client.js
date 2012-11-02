var util             = require('util'),
    events           = require('events'),
    crypto           = require('crypto'),
    _                = require('underscore'),
    IrcConnection    = require('./irc/connection.js').IrcConnection,
    IrcCommands      = require('./irc/commands.js'),
    ClientCommands   = require('./clientcommands.js');


var Client = function (websocket) {
    var that = this;
    
    events.EventEmitter.call(this);
    this.websocket = websocket;

    // Clients address
    this.real_address = this.websocket.handshake.real_address;

    // A hash to identify this client instance
    this.hash = crypto.createHash('sha256')
        .update(this.real_address)
        .update('' + Date.now())
        .update(Math.floor(Math.random() * 100000).toString())
        .digest('hex');
    
    this.irc_connections = [];
    this.next_connection = 0;
    
    this.buffer = {
        list: [],
        motd: ''
    };
    
    // Handler for any commands sent from the client
    this.client_commands = new ClientCommands(this);

    websocket.on('irc', function () {
        handleClientMessage.apply(that, arguments);
    });
    websocket.on('kiwi', function () {
        kiwiCommand.apply(that, arguments);
    });
    websocket.on('disconnect', function () {
        websocketDisconnect.apply(that, arguments);
    });
    websocket.on('error', function () {
        websocketError.apply(that, arguments);
    });
};
util.inherits(Client, events.EventEmitter);

module.exports.Client = Client;

// Callback API:
// Callbacks SHALL accept 2 arguments, error and response, in that order.
// error MUST be null where the command is successul.
// error MUST otherwise be a truthy value and SHOULD be a string where the cause of the error is known.
// response MAY be given even if error is truthy

Client.prototype.sendIrcCommand = function (command, data, callback) {
    var c = {command: command, data: data};
    this.websocket.emit('irc', c, callback);
};

Client.prototype.sendKiwiCommand = function (command, data, callback) {
    var c = {command: command, data: data};
    this.websocket.emit('kiwi', c, callback);
};

Client.prototype.dispose = function () {
    this.emit('destroy');
    this.removeAllListeners();
};

function handleClientMessage(msg, callback) {
    var server, args, obj, channels, keys;

    // Make sure we have a server number specified
    if ((msg.server === null) || (typeof msg.server !== 'number')) {
        return (typeof callback === 'function') ? callback('server not specified') : undefined;
    } else if (!this.irc_connections[msg.server]) {
        return (typeof callback === 'function') ? callback('not connected to server') : undefined;
    }

    // The server this command is directed to
    server = this.irc_connections[msg.server];

    if (typeof callback !== 'function') {
        callback = null;
    }

    try {
        msg.data = JSON.parse(msg.data);
    } catch (e) {
        kiwi.log('[handleClientMessage] JSON parsing error ' + msg.data);
        return;
    }

    // Run the client command
    this.client_commands.run(msg.data.method, msg.data.args, server, callback);
}




function kiwiCommand(command, callback) {
    var that = this;
    
    if (typeof callback !== 'function') {
        callback = function () {};
    }
    switch (command.command) {
		case 'connect':
			if (command.hostname && command.port && command.nick) {
				var con = new IrcConnection(command.hostname, command.port, command.ssl,
					command.nick, {hostname: this.websocket.handshake.revdns, address: this.websocket.handshake.real_address},
					command.password);

				var con_num = this.next_connection++;
				this.irc_connections[con_num] = con;

				var irc_commands = new IrcCommands(con, con_num, this);
				irc_commands.bindEvents();
				
				con.on('connected', function () {
					return callback(null, con_num);
				});
				
				con.on('error', function (err) {
                    console.log('irc_connection error (' + command.hostname + '):', err);
                    // TODO: Once multiple servers implemented, specify which server failed
                    //that.sendKiwiCommand('error', {server: con_num, error: err});
                    return callback(err.code, null);
				});
                
                con.on('close', function () {
                    that.irc_connections[con_num] = null;
                });
			} else {
				return callback('Hostname, port and nickname must be specified');
			}
		break;
		default:
			callback();
    }
}


// Websocket has disconnected, so quit all the IRC connections
function websocketDisconnect() {
    _.each(this.irc_connections, function (irc_connection, i, cons) {
        if (irc_connection) {
            irc_connection.end('QUIT :' + (global.config.quit_message || ''));
            irc_connection.dispose();
            cons[i] = null;
        }
    });
    
    this.dispose();
}


// TODO: Should this close all the websocket connections too?
function websocketError() {
    this.dispose();
}
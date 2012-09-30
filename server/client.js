var util             = require('util'),
    events           = require('events'),
    _                = require('underscore'),
    IRCConnection    = require('./irc-connection.js').IRCConnection,
    IRCCommands      = require('./irc-commands.js'),
    ClientCommandset = require('./client-commands.js').ClientCommandset;

var Client = function (websocket) {
    var c = this;
    
    events.EventEmitter.call(this);
    this.websocket = websocket;
    
    this.IRC_connections = [];
    this.next_connection = 0;
    
    this.buffer = {
        list: [],
        motd: ''
    };
    
    // Handler for any commands sent from the client
    this.client_commands = new ClientCommandset(this);

    websocket.on('irc', function () {
        handleClientMessage.apply(c, arguments);
    });
    websocket.on('kiwi', function () {
        kiwi_command.apply(c, arguments);
    });
    websocket.on('disconnect', function () {
        disconnect.apply(c, arguments);
    });
    websocket.on('error', function () {
        error.apply(c, arguments);
    });
};
util.inherits(Client, events.EventEmitter);

module.exports.Client = Client;

// Callback API:
// Callbacks SHALL accept 2 arguments, error and response, in that order.
// error MUST be null where the command is successul.
// error MUST otherwise be a truthy value and SHOULD be a string where the cause of the error is known.
// response MAY be given even if error is truthy

Client.prototype.sendIRCCommand = function (command, data, callback) {
    var c = {command: command, data: data};
    //console.log('C<--', c);
    this.websocket.emit('irc', c, callback);
};

Client.prototype.sendKiwiCommand = function (command, callback) {
    this.websocket.emit('kiwi', command, callback);
};

var handleClientMessage = function (msg, callback) {
    var server, args, obj, channels, keys;

    // Make sure we have a server number specified
    if ((msg.server === null) || (typeof msg.server !== 'number')) {
        return callback('server not specified');
    } else if (!this.IRC_connections[msg.server]) {
        return callback('not connected to server');
    }

    // The server this command is directed to
    server = this.IRC_connections[msg.server];

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
};




var kiwi_command = function (command, callback) {
    var that = this;
    console.log(typeof callback);
    if (typeof callback !== 'function') {
        callback = function () {};
    }
    switch (command.command) {
		case 'connect':
			if ((command.hostname) && (command.port) && (command.nick)) {
				var con = new IRCConnection(command.hostname, command.port, command.ssl,
					command.nick, {hostname: this.websocket.handshake.revdns, address: this.websocket.handshake.address.address},
					command.password, null);

				var con_num = this.next_connection++;
				this.IRC_connections[con_num] = con;

				var binder = new IRCCommands.Binder(con, con_num, this);
				binder.bind_irc_commands();
				
				con.on('connected', function () {
                    console.log("con.on('connected')");
					return callback(null, con_num);
				});
				
				con.on('error', function (err) {
					this.websocket.sendKiwiCommand('error', {server: con_num, error: err});
				});
                
                con.on('close', function () {
                    that.IRC_connections[con_num] = null;
                });
			} else {
				return callback('Hostname, port and nickname must be specified');
			}
		break;
		default:
			callback();
    }
};

var extension_command = function (command, callback) {
    if (typeof callback === 'function') {
        callback('not implemented');
    }
};

var disconnect = function () {
    _.each(this.IRC_connections, function (irc_connection, i, cons) {
        if (irc_connection) {
            irc_connection.end('QUIT :Kiwi IRC');
            cons[i] = null;
        }
    });
    this.emit('destroy');
};

var error = function () {
    this.emit('destroy');
};

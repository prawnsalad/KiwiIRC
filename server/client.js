var util            = require('util'),
    events          = require('events'),
    IRCConnection   = require('./irc-connection.js').IRCConnection;
    IRCCommands     = require('./irc-commands.js');

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
    
    websocket.on('irc', function () {
        IRC_command.apply(c, arguments);
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
    console.log('C<--', c);
    this.websocket.emit('irc', c, callback);
};

Client.prototype.sendKiwiCommand = function (command, callback) {
    this.websocket.emit('kiwi', command, callback);
};

var IRC_command = function (command, callback) {
    console.log('C-->', command);
    var method, str = '';
    if (typeof callback !== 'function') {
        callback = function () {};
    }
    if ((command.server === null) || (typeof command.server !== 'number')) {
        return callback('server not specified');
    } else if (!this.IRC_connections[command.server]) {
        return callback('not connected to server');
    }
    
    command.data = JSON.parse(command.data);
    
    if (command.data.method === 'ctcp') {
        if (command.data.args.request) {
            str += 'PRIVMSG ';
        } else {
            str += 'NOTICE ';
        }
        str += command.data.args.target + ' :'
        str += String.fromCharCode(1) + command.data.args.type + ' ';
        str += command.data.args.params + String.fromCharCode(1);
        this.IRC_connections[command.server].send(str);
    } else if (command.data.method === 'raw') {
        this.IRC_connections[command.server].send(command.data.args.data);
    } else if (command.data.method === 'kiwi') {
        // do special Kiwi stuff here
    } else {
        method = command.data.method;
        command.data = command.data.args;
        this.IRC_connections[command.server].send(method + ((command.data.params) ? ' ' + command.data.params.join(' ') : '') + ((command.data.trailing) ? ' :' + command.data.trailing : ''), callback);
    }
};

var kiwi_command = function (command, callback) {
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
    this.emit('destroy');
};

var error = function () {
    this.emit('destroy');
};

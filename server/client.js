var util             = require('util'),
    events           = require('events'),
    crypto           = require('crypto'),
    _                = require('lodash'),
    State            = require('./irc/state.js'),
    IrcConnection    = require('./irc/connection.js').IrcConnection,
    ClientCommands   = require('./clientcommands.js'),
    WebsocketRpc     = require('./websocketrpc.js'),
    Stats            = require('./stats.js');


var Client = function (websocket, opts) {
    var that = this;

    Stats.incr('client.created');

    events.EventEmitter.call(this);
    this.websocket = websocket;

    // Keep a record of how this client connected
    this.server_config = opts.server_config;

    this.rpc = new WebsocketRpc(this.websocket);
    this.rpc.on('all', function(func_name, return_fn) {
        if (typeof func_name === 'string' && typeof return_fn === 'function') {
            Stats.incr('client.command');
            Stats.incr('client.command.' + func_name);
        }
    });

    // Clients address
    this.real_address = this.websocket.meta.real_address;

    // A hash to identify this client instance
    this.hash = crypto.createHash('sha256')
        .update(this.real_address)
        .update('' + Date.now())
        .update(Math.floor(Math.random() * 100000).toString())
        .digest('hex');

    this.state = new State(this);

    this.buffer = {
        list: [],
        motd: ''
    };

    // Handler for any commands sent from the client
    this.client_commands = new ClientCommands(this);
    this.client_commands.addRpcEvents(this, this.rpc);

    // Handles the kiwi.* RPC functions
    this.attachKiwiCommands();

    websocket.on('message', function() {
        // A message from the client is a sure sign the client is still alive, so consider it a heartbeat
        that.heartbeat();
    });

    websocket.on('close', function () {
        websocketDisconnect.apply(that, arguments);
    });
    websocket.on('error', function () {
        websocketError.apply(that, arguments);
    });

    this.disposed = false;

    // Start the heartbeating process
    this.heartbeat();

    // Let the client know it's finished connecting
    this.sendKiwiCommand('connected');
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
    this.rpc('irc', c, callback);
};

Client.prototype.sendKiwiCommand = function (command, data, callback) {
    var c = {command: command, data: data};
    this.rpc('kiwi', c, callback);
};

Client.prototype.dispose = function () {
    Stats.incr('client.disposed');

    if (this._heartbeat_tmr) {
        clearTimeout(this._heartbeat_tmr);
    }

    this.rpc.dispose();
    this.websocket.removeAllListeners();

    this.disposed = true;
    this.emit('dispose');

    this.removeAllListeners();
};



Client.prototype.heartbeat = function() {
    if (this._heartbeat_tmr) {
        clearTimeout(this._heartbeat_tmr);
    }

    // After 2 minutes of this heartbeat not being called again, assume the client has disconnected
    this._heartbeat_tmr = setTimeout(_.bind(this._heartbeat_timeout, this), 120000);
};


Client.prototype._heartbeat_timeout = function() {
    Stats.incr('client.timeout');
    websocketDisconnect.apply(this);
};



Client.prototype.attachKiwiCommands = function() {
    var that = this;

    this.rpc.on('kiwi.connect_irc', function(callback, command) {
        if (command.hostname && command.port && command.nick) {
            var options = {};

            // Get any optional parameters that may have been passed
            if (command.encoding)
                options.encoding = command.encoding;

            options.password = global.config.restrict_server_password || command.password;
            options.realname = global.config.restrict_server_realname || command.realname;
            options.username = global.config.restrict_server_username || command.username;

            that.state.connect(
                (global.config.restrict_server || command.hostname),
                (global.config.restrict_server_port || command.port),
                (typeof global.config.restrict_server_ssl !== 'undefined' ?
                    global.config.restrict_server_ssl :
                    command.ssl),
                command.nick,
                {hostname: that.websocket.meta.revdns, address: that.websocket.meta.real_address},
                options,
                callback);
        } else {
            return callback('Hostname, port and nickname must be specified');
        }
    });


    this.rpc.on('kiwi.client_info', function(callback, args) {
        // keep hold of selected parts of the client_info
        that.client_info = {
            build_version: args.build_version.toString() || undefined
        };
    });


    // Just to let us know the client is still there
    this.rpc.on('kiwi.heartbeat', function(callback, args) {
        that.heartbeat();
    });
};



// Websocket has disconnected, so quit all the IRC connections
function websocketDisconnect() {
    this.emit('disconnect');

    this.dispose();
}


// TODO: Should this close all the websocket connections too?
function websocketError() {
    this.dispose();
}

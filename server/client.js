var util             = require('util'),
    events           = require('events'),
    crypto           = require('crypto'),
    _                = require('lodash'),
    State            = require('./irc/state.js'),
    IrcConnection    = require('./irc/connection.js').IrcConnection,
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

    // TODO: Don't blindly add a state here, check if we're continuing a session first
    this.state = new State(true);
    this.state.attachClient(this);

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

    this.disposed = false;
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


Client.prototype.syncClient = function () {
    var servers = [],
        channels = [];

    // Note that we're now syncing data
    this.state.is_syncing = true;

    _.each(this.state.irc_connections, function(irc_connection) {
        if (!irc_connection) return;

        channels = [];
        _.each(irc_connection.irc_channels, function(channel) {
            channels.push({name: channel.name});
        });

        servers.push({
            id: irc_connection.con_num,
            network_name: irc_connection.server.network_name,
            nick: irc_connection.nick,
            host: irc_connection.irc_host.hostname,
            port: irc_connection.irc_host.port,
            ssl: irc_connection.ssl,
            password: '',          // Keep this blank for now
            channels: channels
        });
    });

    this.sendKiwiCommand('sync_session_data', {servers: servers});


    this.state.irc_connections.forEach(function(irc_connection, irc_connection_idx) {
        // TODO: This is hacky.. shouldn't be emitting this event from here
        // Force the MOTD + network options down to the client
        irc_connection.emit('server * motd_end');
        irc_connection.emit('server * options', irc_connection.server.server_options);

        _.each(irc_connection.irc_channels, function(channel) {
            irc_connection.write('NAMES ' + channel.name);

            global.storage.getEvents(irc_connection.state.hash, irc_connection.con_num, channel.name, function(events){
                _.each(events, function (event, idx) {
                    console.log('channel ' + channel.name + ' ' + event.name);
                    irc_connection.emit('channel ' + channel.name + ' ' + event.name, event.obj);
                });
            });
        });
    });

    delete this.state.is_syncing;
};


Client.prototype.dispose = function () {
    if (this.state)
        this.state.detachClient(this);

    this.disposed = true;

    this.emit('dispose');
    this.removeAllListeners();
};

function handleClientMessage(msg, callback) {
    var server;

    // Make sure we have a server number specified
    if ((msg.server === null) || (typeof msg.server !== 'number')) {
        return (typeof callback === 'function') ? callback('server not specified') : undefined;
    } else if (!this.state.irc_connections[msg.server]) {
        return (typeof callback === 'function') ? callback('not connected to server') : undefined;
    }

    // The server this command is directed to
    server = this.state.irc_connections[msg.server];

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
                var options = {};

                // Get any optional parameters that may have been passed
                if (command.encoding)
                    options.encoding = command.encoding;

                options.password = global.config.restrict_server_password || command.password;

                this.state.connect(
                    (global.config.restrict_server || command.hostname),
                    (global.config.restrict_server_port || command.port),
                    (typeof global.config.restrict_server_ssl !== 'undefined' ?
                        global.config.restrict_server_ssl :
                        command.ssl),
                    command.nick,
                    {hostname: this.websocket.handshake.revdns, address: this.websocket.handshake.real_address},
                    options,
                    callback);
            } else {
                return callback('Hostname, port and nickname must be specified');
            }

            break;

        /**
         * Persistant state stuff
         * Taking a session_id (state.hash) from the client, switch
         * the current state with one that matches the session_id.
         */
        case 'save_session':
            if (command.username && !that.state.save_state) {
                this.state.savePersistence(function (){
                    callback({stored: true});
                });
            } else if (that.state.save_state) {
                callback({stored: true});
            }

            callback({stored: false});

            break;

        case 'continue_session':
            var state;

            if (command.username) {
                global.storage.getStates(command.username, function(states) {
                    var hash_id, state;

                    if (!states || states.length === 0) {
                        callback({error: 'UserState does not exist'});
                    }

                    hash_id = states[states.length-1];
                    state = global.states.get(hash_id);

                    if (!state) {
                        callback({error: 'State does not exist '+hash_id});
                        return;
                    }

                    // Remove the existing state
                    if (that.state)
                        that.state.dispose();

                    // Attach this client to the new state
                    state.attachClient(that);

                    // Keep a reference to this state for ourselves
                    that.state = state;

                    // Finally.. sync the state + browser
                    that.syncClient();

                    return callback();

                });
            }

            break;

        default:
            callback();
    }
}


// Websocket has disconnected, so quit all the IRC connections
function websocketDisconnect() {
    this.emit('disconnect');

    this.dispose();
}


// TODO: Should this close all the websocket connections too?
function websocketError() {
    this.dispose();
}

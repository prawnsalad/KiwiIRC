/**
 * Server control via TCP socket
 *
 * Listens on localhost:8888 by default
 */

var net         = require('net'),
    kiwiModules = require('../server/modules'),
    rehash      = require('../server/rehash.js'),
    config      = require('../server/configuration.js'),
    _           = require('lodash');

var control_module = new kiwiModules.Module('Control');


/**
 * The socket client
 */
function SocketClient (socket) {
    this.socket = socket;
    this.socket_closing = false;

    this.remoteAddress = this.socket.remoteAddress;
    console.log('Control connection from ' + this.socket.remoteAddress + ' opened');

    this.bindEvents();

    socket.write("\nHello, you are connected to the Kiwi server :)\n\n");
    this.displayPrompt();
}

SocketClient.prototype.bindEvents = function() {
    var that = this;

    this.socket.on('data', function() { that.onData.apply(that, arguments); });
    this.socket.on('close', function() { that.onClose.apply(that, arguments); });
};
SocketClient.prototype.unbindEvents = function() {
    this.socket.removeAllListeners();
};



SocketClient.prototype.write = function(data, append) {
    if (typeof append === 'undefined') append = '\n';
    if (this.socket && !this.socket_closing)
        this.socket.write(data + append);
};
SocketClient.prototype.displayPrompt = function(prompt) {
    prompt = prompt || 'Kiwi > ';
    this.write(prompt, '');
};



SocketClient.prototype.onData = function(data) {
    data = data.toString().trim();



    try {
        var data_split = data.split(' ');

        if (typeof socket_commands[data_split[0]] === 'function') {
            socket_commands[data_split[0]].call(this, data_split.slice(1));
        } else {
            this.write('Unrecognised command: ' + data);
        }

    } catch (err) {
        console.log('[Control error] ' + err);
        this.write('An error occured. Check the Kiwi server log for more details');
    }

    this.displayPrompt();
};


SocketClient.prototype.onClose = function() {
    this.unbindEvents();
    this.socket = null;
    console.log('Control connection from ' + this.remoteAddress + ' closed');
};



/**
 * Available commands
 * Each function is run in context of the SocketClient
 */
var socket_commands = {
    module: function(data) {
        switch(data[0]) {
            case 'reload':
                if (!data[1]) {
                    this.write('A module name must be specified');
                    return;
                }

                if (!kiwiModules.unload(data[1])) {
                    this.write('Module ' + (data[1] || '') + ' is not loaded');
                    return;
                }

                if (!kiwiModules.load(data[1])) {
                    this.write('Error loading module ' + (data[1] || ''));
                }
                this.write('Module ' + data[1] + ' reloaded');

                break;

            case 'list':
            case 'ls':
            default:
                var module_names = [];
                kiwiModules.getRegisteredModules().forEach(function(module) {
                    module_names.push(module.module_name);
                });
                this.write('Loaded modules: ' + module_names.join(', '));
        }

    },

    stats: function(data) {
        this.write('Connected clients: ' + _.size(global.clients.clients).toString());
        this.write('Num. remote hosts: ' + _.size(global.clients.addresses).toString());
    },

    rehash: function(data) {
        rehash.rehashAll();
        this.write('Rehashed');
    },

    reconfig: function(data) {
        if (config.loadConfig()) {
            this.write('New config file loaded');
        } else {
            this.write("No new config file was loaded");
        }
    },

    quit: function(data) {
        this.socket.destroy();
        this.socket_closing = true;
    },
    exit: function(data) {
        this.socket.destroy();
        this.socket_closing = true;
    }
};


/**
 * Start the control socket server to serve connections
 */
var server = net.createServer(function (socket) {
    new SocketClient(socket);
});
server.listen(8888);

control_module.on('dispose', function() {
    server.close();
});

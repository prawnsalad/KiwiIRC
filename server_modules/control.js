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

var module = new kiwiModules.Module('Control');


function SocketClient (socket) {
    this.socket = socket;

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
    this.socket.write(data + append);
};
SocketClient.prototype.displayPrompt = function(prompt) {
    prompt = prompt || 'Kiwi > ';
    this.write(prompt, '');
};



SocketClient.prototype.onData = function(data) {
    data = data.toString().trim();

    try {
        switch (data) {
            case 'modules':
                this.write('Loaded modules: ' + Object.keys(kiwiModules.getRegisteredModules()).join(', '));
                break;

            case 'stats':
                this.write('Connected clients: ' + _.size(global.clients.clients).toString());
                this.write('Num. remote hosts: ' + _.size(global.clients.addresses).toString());
                break;

            case 'rehash':
                rehash.rehashAll();
                this.write('Rehashed');
                break;

            case 'reconfig':
                if (config.loadConfig()) {
                    this.write('New config file loaded');
                } else {
                    this.write("No new config file was loaded");
                }
                break;

            case 'exit':
            case 'quit':
                this.socket.destroy();
                break;

            default:
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
    console.log('Control connection from ' + this.remoteAddress + ' closed');
};




var server = net.createServer(function (socket) {
    new SocketClient(socket);
});
server.listen(8888);
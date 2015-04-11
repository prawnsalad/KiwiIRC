/**
 * Server control via TCP socket
 *
 * Listens on localhost:8888 by default
 */

var net                = require('net'),
    path               = require('path'),
    _                  = require('lodash'),
    winston            = require('winston'),
    ControlInterface;

function initModule(server_dir) {
    var kiwiModules = require(path.join(server_dir, 'modules.js')),
        control_module = new kiwiModules.Module('Control'),
        ControlInterface = require(path.join(server_dir, 'controlinterface.js'));

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
}

module.exports = initModule;


/**
 * The socket client
 */
function SocketClient (socket) {
    var that = this;

    this.socket = socket;
    this.socket_closing = false;

    this.remoteAddress = this.socket.remoteAddress;
    winston.info('Control connection from %s opened', this.socket.remoteAddress);

    this.bindEvents();

    socket.write("\nHello, you are connected to the Kiwi server :)\n\n");

    this.control_interface = new ControlInterface(socket);
    _.each(socket_commands, function(fn, command_name) {
        that.control_interface.addCommand(command_name, fn.bind(that));
    });
}

SocketClient.prototype.bindEvents = function() {
    var that = this;

    this.socket.on('close', function() { that.onClose.apply(that, arguments); });
};


SocketClient.prototype.unbindEvents = function() {
    this.socket.removeAllListeners();
};


SocketClient.prototype.onClose = function() {
    this.control_interface.dispose();
    this.control_interface = null;

    this.unbindEvents();
    this.socket = null;

    winston.info('Control connection from %s closed', this.remoteAddress);
};



/**
 * Available commands
 * Each function is run in context of the SocketClient
 */
var socket_commands = {
    quit: function(data) {
        this.socket.destroy();
        this.socket_closing = true;
    },
    exit: function(data) {
        this.socket.destroy();
        this.socket_closing = true;
    }
};

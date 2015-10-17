var net     = require('net'),
    winston = require('winston');

var IdentdServer = module.exports = function(opts) {

    var that = this;

    var default_user_id = 'melon',
        default_system_id = 'UNIX-MelonIRC';

    // Option defaults
    opts = opts || {};
    opts.bind_addr = opts.bind_addr || '0.0.0.0';
    opts.bind_port = opts.bind_port || 113;
    opts.system_id = opts.system_id || default_system_id;
    opts.user_id = opts.user_id || default_user_id;


    var server = net.createServer(function(socket) {
        var buffer = '';

        socket.on('data', function(data){
            var data_line, response;

            buffer += data.toString();

            // If we exceeed 512 bytes, presume a flood and disconnect
            if (buffer.length < 512) {

                // Wait until we have a full line of data before processing it
                if (buffer.indexOf('\n') === -1)
                    return;

                // Get the first line of data and process it for a rsponse
                data_line = buffer.split('\n')[0];
                response = that.processLine(data_line);

            }

            // Close down the socket while sending the response
            socket.removeAllListeners();
            socket.end(response);
        });

    });

    server.on('listening', function() {
        var addr = server.address();
        winston.info('Ident Server listening on %s:%s', addr.address, addr.port);
    });


    this.start = function() {
        server.listen(opts.bind_port, opts.bind_addr);
    };

    this.stop = function(callback) {
        server.close(callback);
    };


    /**
     * Process a line of data for an Identd response
     *
     * @param {String} The line of data to process
     * @return {String} Data to send back to the Identd client
     */
    this.processLine = function(line) {
        var ports = line.split(','),
            port_here = 0,
            port_there = 0;

        // We need 2 port number to make this work
        if (ports.length < 2)
            return;

        port_here = parseInt(ports[0], 10);
        port_there = parseInt(ports[1], 10);

        // Make sure we have both ports to work with
        if (!port_here || !port_there)
            return;

        if (typeof opts.user_id === 'function') {
            user = (opts.user_id(port_here, port_there) || '').toString() || default_user_id;
        } else {
            user = opts.user_id.toString();
        }

        if (typeof opts.system_id === 'function') {
            system = (opts.system_id(port_here, port_there) || '').toString() || default_system_id;
        } else {
            system = opts.system_id.toString();
        }

        return port_here.toString() + ' , ' + port_there.toString() + ' : USERID : ' + system + ' : ' + user;
    };
};

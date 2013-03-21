var net = require('net');

function IdentdServer(opts) {

    // Option defaults
    opts = opts || {};
    opts.bind_addr = opts.bind_addr || '0.0.0.0';
    opts.bind_port = opts.bind_port || 113;
    opts.system_id = opts.system_id || 'UNIX-KiwiIRC';
    opts.user_id = opts.user_id || 'kiwi';


    var server = net.createServer(function(socket) {
        var user, system;

        if (typeof opts.user_id === 'function') {
            user = opts.user_id(socket).toString();
        } else {
            user = opts.user_id.toString();
        }

        if (typeof opts.system_id === 'function') {
            system = opts.system_id(socket).toString();
        } else {
            system = opts.system_id.toString();
        }

        socket.end('25,25 : USERID : ' + system + ' : ' + user);
    });

    server.on('listening', function() {
        console.log('Ident Server listening on ' + server.address().address + ':' +  server.address().port);
    });


    this.start = function() {
        server.listen(opts.bind_port, opts.bind_addr);
    };

    this.stop = function(callback) {
        server.close(callback);
    };
}


module.exports = IdentdServer;
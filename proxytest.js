var Proxy  = require('./server/proxy'),
    Identd = require('./server/identd');

var port_pairs = {};


var serv = new Proxy.ProxyServer();
serv.listen(7779, '0.0.0.0');

serv.on('connection_open', function(pipe) {
    pipe.identd_pair = pipe.irc_socket.localPort.toString() + '_' + pipe.irc_socket.remotePort.toString();
    console.log('[IDENTD] opened ' + pipe.identd_pair);
    port_pairs[pipe.identd_pair] = pipe.meta;
});

serv.on('connection_close', function(pipe) {
    console.log('[IDENTD] closed ' + pipe.identd_pair);
    delete port_pairs[pipe.identd_pair];
});




// Username lookup function for the identd
var identdResolveUser = function(port_here, port_there, callback) {
    var key = port_here.toString() + '_' + port_there.toString();
    console.log('[IDENTD] lookup ' + key);
    return port_pairs[key].username;
};

var identd_server = new Identd({
        bind_addr: '0.0.0.0',
        bind_port: 113,
        user_id: identdResolveUser
    });

identd_server.start();
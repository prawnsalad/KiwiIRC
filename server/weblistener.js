var ws          = require('socket.io'),
    events      = require('events'),
    http        = require('http'),
    https       = require('https'),
    util        = require('util'),
    fs          = require('fs'),
    dns         = require('dns'),
    url         = require('url'),
    _           = require('underscore'),
    config      = require('./configuration.js'),
    Client      = require('./client.js').Client,
    HttpHandler = require('./httphandler.js').HttpHandler,
    rehash      = require('./rehash.js');



rehash.on('rehashed', function (files) {
    Client = require('./client.js').Client;
    HttpHandler = require('./httphandler.js').HttpHandler;
});


// Instance of HttpHandler
var http_handler;


var WebListener = function (web_config, transports) {
    var hs, opts, ws_opts,
        that = this;


    events.EventEmitter.call(this);
    
    http_handler = new HttpHandler(web_config);
    
    // Standard options for the socket.io connections
    ws_opts = {
        'log level': 0,
        'log colors': 0
    };


    if (web_config.ssl) {
        opts = {
            key: fs.readFileSync(__dirname + '/' + web_config.ssl_key),
            cert: fs.readFileSync(__dirname + '/' + web_config.ssl_cert)
        };

        // Do we have an intermediate certificate?
        if (typeof web_config.ssl_ca !== 'undefined') {
            opts.ca = fs.readFileSync(__dirname + '/' + web_config.ssl_ca);
        }


        hs = https.createServer(opts, handleHttpRequest);
        
        // Start socket.io listening on this weblistener
        this.ws = ws.listen(hs, _.extend({ssl: true}, ws_opts));
        hs.listen(web_config.port, web_config.address);

        console.log('Listening on ' + web_config.address + ':' + web_config.port.toString() + ' with SSL');
    } else {

        // Start some plain-text server up
        hs = http.createServer(handleHttpRequest);

        // Start socket.io listening on this weblistener
        this.ws = ws.listen(hs, _.extend({ssl: false}, ws_opts));
        hs.listen(web_config.port, web_config.address);

        console.log('Listening on ' + web_config.address + ':' + web_config.port.toString() + ' without SSL');
    }
    
    this.ws.enable('browser client minification');
    this.ws.enable('browser client etag');
    this.ws.set('transports', transports);
    this.ws.set('resource', (config.get().http_base_path || '') + '/transport');

    this.ws.of('/kiwi').authorization(authoriseConnection)
        .on('connection', function () {
            newConnection.apply(that, arguments);
        }
    );
    this.ws.of('/kiwi').on('error', console.log);
};
util.inherits(WebListener, events.EventEmitter);



function handleHttpRequest(request, response) {
    var uri = url.parse(request.url, true);
    
    // If this isn't a socket.io request, pass it onto the http handler
    if (uri.pathname.substr(0, 10) !== '/socket.io') {
        http_handler.serve(request, response);
    }
}


/**
 * Get the reverse DNS entry for this connection.
 * Used later on for webirc, etc functionality
 */
function authoriseConnection(handshakeData, callback) {
    var address = handshakeData.address.address;

    // If a forwarded-for header is found, switch the source address
    if (handshakeData.headers['x-forwarded-for']) {
        // Check we're connecting from a whitelisted proxy
        if (!config.get().http_proxies || config.get().http_proxies.indexOf(address) < 0) {
            console.log('Unlisted proxy:', address);
            callback(null, false);
            return;
        }

        // We're sent from a whitelisted proxy, replace the hosts
        address = handshakeData.headers['x-forwarded-for'];
    }

    handshakeData.real_address = address;
    
    if (global.clients.numOnAddress(address) + 1 > config.get().max_client_conns) {
        return callback(null, false);
    }
    
    dns.reverse(address, function (err, domains) {
        if (err || domains.length === 0) {
            handshakeData.revdns = address;
        } else {
            handshakeData.revdns = _.first(domains) || address;
        }
        
        // All is well, authorise the connection
        callback(null, true);
    });
}

function newConnection(websocket) {
    var client, that = this;
    client = new Client(websocket);
    client.on('destroy', function () {
        that.emit('destroy', this);
    });
    this.emit('connection', client);
}





module.exports = WebListener;
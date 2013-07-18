var ws          = require('socket.io'),
    events      = require('events'),
    http        = require('http'),
    https       = require('https'),
    util        = require('util'),
    fs          = require('fs'),
    dns         = require('dns'),
    url         = require('url'),
    _           = require('lodash'),
    spdy        = require('spdy'),
    Client      = require('./client.js').Client,
    HttpHandler = require('./httphandler.js').HttpHandler,
    rehash      = require('./rehash.js'),
    range_check = require('range_check');



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
            key: fs.readFileSync(web_config.ssl_key),
            cert: fs.readFileSync(web_config.ssl_cert)
        };

        // Do we have an intermediate certificate?
        if (typeof web_config.ssl_ca !== 'undefined') {
            // An array of them?
            if (typeof web_config.ssl_ca.map !== 'undefined') {
                opts.ca = web_config.ssl_ca.map(function (f) { return fs.readFileSync(f); });

            } else {
                opts.ca = fs.readFileSync(web_config.ssl_ca);
            }
        }

        hs = spdy.createServer(opts, handleHttpRequest);

        // Start socket.io listening on this weblistener
        this.ws = ws.listen(hs, _.extend({ssl: true}, ws_opts));
        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    } else {

        // Start some plain-text server up
        hs = http.createServer(handleHttpRequest);

        // Start socket.io listening on this weblistener
        this.ws = ws.listen(hs, _.extend({ssl: false}, ws_opts));
        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    }

    hs.on('error', function (err) {
        that.emit('error', err);
    });

    this.ws.enable('browser client minification');
    this.ws.enable('browser client etag');
    this.ws.set('transports', transports);
    this.ws.set('resource', (global.config.http_base_path || '') + '/transport');

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
    if (handshakeData.headers[global.config.http_proxy_ip_header || 'x-forwarded-for']) {
        // Check we're connecting from a whitelisted proxy
        if (!global.config.http_proxies || !range_check.in_range(address, global.config.http_proxies)) {
            console.log('Unlisted proxy:', address);
            callback(null, false);
            return;
        }

        // We're sent from a whitelisted proxy, replace the hosts
        address = handshakeData.headers['x-forwarded-for'];
    }

    handshakeData.real_address = address;

    // If enabled, don't go over the connection limit
    if (global.config.max_client_conns && global.config.max_client_conns > 0) {
        if (global.clients.numOnAddress(address) + 1 > global.config.max_client_conns) {
            return callback(null, false);
        }
    }


    try {
        dns.reverse(address, function (err, domains) {
            if (err || domains.length === 0) {
                handshakeData.revdns = address;
            } else {
                handshakeData.revdns = _.first(domains) || address;
            }

            // All is well, authorise the connection
            callback(null, true);
        });
    } catch (err) {
        handshakeData.revdns = address;
        callback(null, true);
    }
}

function newConnection(websocket) {
    var client, that = this;
    client = new Client(websocket);
    client.on('dispose', function () {
        that.emit('client_dispose', this);
    });
    this.emit('connection', client);
}





module.exports = WebListener;

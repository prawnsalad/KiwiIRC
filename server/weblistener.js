var engine       = require('engine.io'),
    WebsocketRpc = require('./websocketrpc.js');
    events       = require('events'),
    http         = require('http'),
    https        = require('https'),
    util         = require('util'),
    fs           = require('fs'),
    dns          = require('dns'),
    url          = require('url'),
    _            = require('lodash'),
    spdy         = require('spdy'),
    ipaddr       = require('ipaddr.js'),
    Client       = require('./client.js').Client,
    HttpHandler  = require('./httphandler.js').HttpHandler,
    rehash       = require('./rehash.js');



rehash.on('rehashed', function (files) {
    Client = require('./client.js').Client;
    HttpHandler = require('./httphandler.js').HttpHandler;
});


// Instance of HttpHandler
var http_handler;


var WebListener = module.exports = function (web_config) {
    var hs, opts,
        that = this;


    events.EventEmitter.call(this);

    http_handler = new HttpHandler(web_config);

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

        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    } else {

        // Start some plain-text server up
        hs = http.createServer(handleHttpRequest);

        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    }

    hs.on('error', function (err) {
        that.emit('error', err);
    });

    this.ws = engine.attach(hs, {
        transports: ['websocket', 'polling', 'flashsocket'],
        path: (global.config.http_base_path || '') + '/transport'
    });

    this.ws.on('connection', function(socket) {
        initialiseSocket(socket, function(err, authorised) {
            var client;

            if (!authorised) {
                socket.close();
                return;
            }

            client = new Client(socket);
            client.on('dispose', function () {
                that.emit('client_dispose', this);
            });

            that.emit('connection', client);

            // Call any modules listening for new clients
            global.modules.emit('client created', {client: client});
        });
    });
};
util.inherits(WebListener, events.EventEmitter);



function handleHttpRequest(request, response) {
    http_handler.serve(request, response);
}

function rangeCheck(addr, range) {
    var i, ranges, parts;
    ranges = (!_.isArray(range)) ? [range] : range;
    for (i = 0; i < ranges.length; i++) {
        parts = ranges[i].split('/');
        if (ipaddr.process(addr).match(ipaddr.process(parts[0]), parts[1])) {
            return true;
        }
    }
    return false;
}


/**
 * Get the reverse DNS entry for this connection.
 * Used later on for webirc, etc functionality
 */
function initialiseSocket(socket, callback) {
    var request = socket.request,
        address = request.connection.remoteAddress,
        revdns;

    // Key/val data stored to the socket to be read later on
    // May also be synced to a redis DB to lookup clients
    socket.meta = {};

    // If a forwarded-for header is found, switch the source address
    if (request.headers[global.config.http_proxy_ip_header || 'x-forwarded-for']) {
        // Check we're connecting from a whitelisted proxy
        if (!global.config.http_proxies || !rangeCheck(address, global.config.http_proxies)) {
            console.log('Unlisted proxy:', address);
            callback(null, false);
            return;
        }

        // We're sent from a whitelisted proxy, replace the hosts
        address = request.headers[global.config.http_proxy_ip_header || 'x-forwarded-for'];
    }

    socket.meta.real_address = address;

    // If enabled, don't go over the connection limit
    if (global.config.max_client_conns && global.config.max_client_conns > 0) {
        if (global.clients.numOnAddress(address) + 1 > global.config.max_client_conns) {
            return callback(null, false);
        }
    }


    try {
        dns.reverse(address, function (err, domains) {
            if (!err && domains.length > 0) {
                revdns = _.first(domains);
            }

            if (!revdns) {
                // No reverse DNS found, use the IP
                socket.meta.revdns = address;
                callback(null, true);

            } else {
                // Make sure the reverse DNS matches the A record to use the hostname..
                dns.lookup(revdns, function (err, ip_address, family) {
                    if (!err && ip_address == address) {
                        // A record matches PTR, perfectly valid hostname
                        socket.meta.revdns = revdns;
                    } else {
                        // A record does not match the PTR, invalid hostname
                        socket.meta.revdns = address;
                    }

                    // We have all the info we need, proceed with the connection
                    callback(null, true);
                });
            }
        });

    } catch (err) {
        socket.meta.revdns = address;
        callback(null, true);
    }
}

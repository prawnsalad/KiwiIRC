var engine       = require('engine.io'),
    WebsocketRpc = require('./websocketrpc.js'),
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
    winston      = require('winston'),
    Client       = require('./client.js').Client,
    HttpHandler  = require('./httphandler.js').HttpHandler,
    rehash       = require('./rehash.js'),
    Stats        = require('./stats.js');



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

        hs = spdy.createServer(opts);

        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    } else {

        // Start some plain-text server up
        hs = http.createServer();

        hs.listen(web_config.port, web_config.address, function () {
            that.emit('listening');
        });
    }

    hs.on('error', function (err) {
        that.emit('error', err);
    });

    this.ws = new engine.Server();

    hs.on('upgrade', function(req, socket, head){
        // engine.io can sometimes "loose" the clients remote address. Keep note of it
        req.meta = {
            remote_address: req.connection.remoteAddress
        };

        that.ws.handleUpgrade(req, socket, head);
    });

    hs.on('request', function(req, res){
        global.modules.emit('http request', {request: req, response: res})
        .then(function httpRequest() {
            var base_path = (global.config.http_base_path || ''),
                transport_url;

            // Trim off any trailing slashes
            if (base_path.substr(base_path.length - 1) === '/') {
                base_path = base_path.substr(0, base_path.length - 1);
            }
            transport_url = base_path + '/transport';

            Stats.incr('http.request');

            // engine.io can sometimes "loose" the clients remote address. Keep note of it
            req.meta = {
                remote_address: req.connection.remoteAddress
            };

            // If the request is for our transport, pass it onto engine.io
            if (req.url.toLowerCase().indexOf(transport_url.toLowerCase()) === 0) {
                that.ws.handleRequest(req, res);
            } else {
                http_handler.serve(req, res);
            }
        });

    });

    this.ws.on('connection', function(socket) {
        Stats.incr('http.websocket');

        initialiseSocket(socket, function(err, authorised) {
            var client;

            if (!authorised) {
                socket.close();
                return;
            }

            client = new Client(socket, {server_config: web_config});
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
        address = request.meta.remote_address,
        revdns;

    // Key/val data stored to the socket to be read later on
    // May also be synced to a redis DB to lookup clients
    socket.meta = socket.request.meta;

    // If a forwarded-for header is found, switch the source address
    if (request.headers[global.config.http_proxy_ip_header || 'x-forwarded-for']) {
        // Check we're connecting from a whitelisted proxy
        if (!global.config.http_proxies || !rangeCheck(address, global.config.http_proxies)) {
            winston.info('Unlisted proxy: %s', address);
            callback(null, false);
            return;
        }

        // We're sent from a whitelisted proxy, replace the hosts
        address = request.headers[global.config.http_proxy_ip_header || 'x-forwarded-for'];

        // Multiple reverse proxies will have a comma delimited list of IPs. We only need the first
        address = address.split(',')[0].trim();

        // Some reverse proxies (IIS) may include the port, so lets remove that
        address = (address || '').split(':')[0];
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

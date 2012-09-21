var ws          = require('socket.io'),
    events      = require('events'),
    http        = require('http'),
    https       = require('https'),
    util        = require('util'),
    fs          = require('fs'),
    dns         = require('dns'),
    _           = require('underscore'),
    Client   = require('./client.js').Client,
    HTTPHandler = require('./http-handler.js').HTTPHandler;

var WebListener = function (config, transports) {
    var handler,
        hs,
        opts,
        that = this;

    events.EventEmitter.call(this);
    
    http_handler = new HTTPHandler(config);
    
    if (config.secure) {
        opts = {
            key: fs.readFileSync(__dirname + '/' + config.ssl_key),
            cert: fs.readFileSync(__dirname + '/' + config.ssl_cert)
        };
        // Do we have an intermediate certificate?
        if (typeof config.ssl_ca !== 'undefined') {
            opts.ca = fs.readFileSync(__dirname + '/' + config.ssl_ca);
        }
        hs = https.createServer(opts, function (request, response) {
            http_handler.handler(request, response);
        });
        
        this.ws = ws.listen(hs, {secure: true});
        hs.listen(config.port, config.address);
        console.log('Listening on ' + config.address + ':' + config.port.toString() + ' with SSL');
    } else {
        // Start some plain-text server up
        hs = http.createServer(function (request, response) {
            http_handler.handler(request, response);
        });
        this.ws = ws.listen(hs, {secure: false});
        hs.listen(config.port, config.address);
        console.log('Listening on ' + config.address + ':' + config.port.toString() + ' without SSL');
    }
    
    this.ws.set('log level', 1);
    this.ws.enable('browser client minification');
    this.ws.enable('browser client etag');
    this.ws.set('transports', transports);

    this.ws.of('/kiwi').authorization(authorisation).on('connection', function () {
        connection.apply(that, arguments);
    });
    this.ws.of('/kiwi').on('error', console.log);
};
util.inherits(WebListener, events.EventEmitter);

module.exports.WebListener = WebListener;

var authorisation = function (handshakeData, callback) {
    dns.reverse(handshakeData.address.address, function (err, domains) {
        handshakeData.revdns = (err) ? handshakeData.address.address : _.first(domains);
        callback(null, true);
    });
};

var connection = function (websocket) {
    //console.log(websocket);
    this.emit('connection', new Client(websocket));
};

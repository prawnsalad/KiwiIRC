var ws          = require('socket.io'),
    events      = require('events'),
    http        = require('http'),
    https       = require('https'),
    util        = require('util'),
    fs          = require('fs'),
    dns         = require('dns'),
    url         = require('url'),
    _           = require('underscore'),
    Client   = require('./client.js').Client,
    HttpHandler = require('./http-handler.js').HttpHandler;

// Instance of HttpHandler
var http_handler;


var WebListener = function (config, transports) {
    var hs,
        opts,
        that = this;

    events.EventEmitter.call(this);
    
    http_handler = new HttpHandler(config);
    
    if (config.secure) {
        opts = {
            key: fs.readFileSync(__dirname + '/' + config.ssl_key),
            cert: fs.readFileSync(__dirname + '/' + config.ssl_cert)
        };

        // Do we have an intermediate certificate?
        if (typeof config.ssl_ca !== 'undefined') {
            opts.ca = fs.readFileSync(__dirname + '/' + config.ssl_ca);
        }


        hs = https.createServer(opts, handleHttpRequest);
        
        // Start socket.io listening on this weblistener
        this.ws = ws.listen(hs, {secure: true});
        hs.listen(config.port, config.address);

        console.log('Listening on ' + config.address + ':' + config.port.toString() + ' with SSL');
    } else {

        // Start some plain-text server up
        hs = http.createServer(handleHttpRequest);

        // Start socket.io listening on this weblistener
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



function handleHttpRequest(request, response) {
    var uri = url.parse(request.url, true);
    
    // If this isn't a socket.io request, pass it onto the http handler
    if (uri.pathname.substr(0, 10) !== '/socket.io') {
        http_handler.serve(request, response);
    }
}


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





module.exports = WebListener;
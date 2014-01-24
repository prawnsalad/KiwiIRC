var stream = require('stream'),
    util   = require('util'),
    events = require('events'),
    net    = require('net'),
    tls    = require('tls'),
    fs     = require('fs');


module.exports = {
    ProxyServer: ProxyServer,
    ProxySocket: ProxySocket
};

function debug() {
    console.log.apply(console, arguments);
}

// Socket connection responses
var RESPONSE_ERROR         = '0';
var RESPONSE_OK            = '1';
var RESPONSE_ECONNRESET    = '2';
var RESPONSE_ECONNREFUSED  = '3';
var RESPONSE_ENOTFOUND     = '4';
var RESPONSE_ETIMEDOUT     = '5';



/**
 * ProxyServer
 * Listens for connections from a kiwi server, dispatching ProxyPipe
 * instances for each connection
 */
function ProxyServer() {
    events.EventEmitter.call(this);
}
util.inherits(ProxyServer, events.EventEmitter);


ProxyServer.prototype.listen = function(listen_port, listen_addr, opts) {
    var that = this,
        serv_opts = {},
        connection_event = 'connection';

    opts = opts || {};

    // Listen using SSL?
    if (opts.ssl) {
        serv_opts = {
            key: fs.readFileSync(opts.ssl_key),
            cert: fs.readFileSync(opts.ssl_cert)
        };

        // Do we have an intermediate certificate?
        if (typeof opts.ssl_ca !== 'undefined') {
            // An array of them?
            if (typeof opts.ssl_ca.map !== 'undefined') {
                serv_opts.ca = opts.ssl_ca.map(function (f) { return fs.readFileSync(f); });

            } else {
                serv_opts.ca = fs.readFileSync(opts.ssl_ca);
            }
        }

        this.server = tls.createServer(serv_opts);

        connection_event = 'secureConnection';

    }

    // No SSL, start a simple clear text server
    else {
        this.server = new net.Server();
    }

    this.server.listen(listen_port, listen_addr, function() {
        that.emit('listening');
    });

    this.server.on(connection_event, function(socket) {
        new ProxyPipe(socket, that);
    });
};


ProxyServer.prototype.close = function(callback) {
    if (this.server) {
        return this.server.close(callback);
    }

    if (typeof callback === 'function')
        callback();
};




/**
 * ProxyPipe
 * Takes connections from a kiwi server, then:
 * 1. Reads its meta data such as username for identd lookups
 * 2. Make the connection to the IRC server
 * 3. Reply to the kiwi server with connection status
 * 4. If all ok, pipe data between the 2 sockets as a proxy
 */
function ProxyPipe(kiwi_socket, proxy_server) {
    debug('[KiwiProxy] New Kiwi connection');

    this.kiwi_socket  = kiwi_socket;
    this.proxy_server = proxy_server;
    this.irc_socket   = null;
    this.buffer       = '';
    this.meta         = null;

    debug('[KiwiProxy] Setting encoding to utf8');
    kiwi_socket.setEncoding('utf8');
    kiwi_socket.on('readable', this.kiwiSocketOnReadable.bind(this));
}


ProxyPipe.prototype.destroy = function() {
    this.buffer = null;
    this.meta = null;

    if (this.irc_socket) {
        this.irc_socket.destroy();
        this.irc_socket.removeAllListeners();
        this.irc_socket = null;
    }

    if (this.kiwi_socket) {
        this.kiwi_socket.destroy();
        this.kiwi_socket.removeAllListeners();
        this.kiwi_socket = null;
    }
};


ProxyPipe.prototype.kiwiSocketOnReadable = function() {
    var chunk, meta;

    while ((chunk = this.kiwi_socket.read()) !== null) {
        this.buffer += chunk;
    }

    // Not got a complete line yet? Wait some more
    if (this.buffer.indexOf('\n') === -1)
        return;

    try {
        debug('[KiwiProxy] Found a complete line in the buffer');
        meta = JSON.parse(this.buffer.substr(0, this.buffer.indexOf('\n')));
    } catch (err) {
        debug('[KiwiProxy] Error parsing meta');
        this.destroy();
        return;
    }

    if (!meta.username) {
        debug('[KiwiProxy] Meta does not contain a username');
        this.destroy();
        return;
    }

    this.buffer = '';
    this.meta = meta;
    this.kiwi_socket.removeAllListeners('readable');

    this.makeIrcConnection();
};


ProxyPipe.prototype.makeIrcConnection = function() {
    debug('[KiwiProxy] Opening proxied connection to: ' + this.meta.host + ':' + this.meta.port.toString());

    var local_address = this.meta.interface ?
        this.meta.interface :
        '0.0.0.0';

    if (this.meta.ssl) {
        this.irc_socket = tls.connect({
            port: parseInt(this.meta.port, 10),
            host: this.meta.host,
            rejectUnauthorized: global.config.reject_unauthorised_certificates,
            localAddress: local_address
        }, this._onSocketConnect.bind(this));

    } else {
        this.irc_socket = net.connect({
            port: parseInt(this.meta.port, 10),
            host: this.meta.host,
            localAddress: local_address
        }, this._onSocketConnect.bind(this));
    }

    this.irc_socket.setTimeout(10000);
    this.irc_socket.on('error', this._onSocketError.bind(this));
    this.irc_socket.on('timeout', this._onSocketTimeout.bind(this));

    // We need the raw socket connect event, not after any SSL handshakes or anything
    if (this.irc_socket.socket) {
        this.irc_socket.socket.on('connect', this._onRawSocketConnect.bind(this));
    } else {
        this.irc_socket.on('connect', this._onRawSocketConnect.bind(this));
    }
};


ProxyPipe.prototype._onRawSocketConnect = function() {
    this.proxy_server.emit('socket_connected', this);
};


ProxyPipe.prototype._onSocketConnect = function() {
    debug('[KiwiProxy] ProxyPipe::_onSocketConnect()');

    this.proxy_server.emit('connection_open', this);

    // Now that we're connected to the detination, return no
    // error back to the kiwi server and start piping
    this.kiwi_socket.write(new Buffer(RESPONSE_OK.toString()), this.startPiping.bind(this));
};


ProxyPipe.prototype._onSocketError = function(err) {
    var replies = {
        ECONNRESET: RESPONSE_ECONNRESET,
        ECONNREFUSED: RESPONSE_ECONNREFUSED,
        ENOTFOUND: RESPONSE_ENOTFOUND,
        ETIMEDOUT: RESPONSE_ETIMEDOUT
    };
    debug('[KiwiProxy] IRC Error ' + err.code);
    this.kiwi_socket.write(new Buffer((replies[err.code] || RESPONSE_ERROR).toString()), 'UTF8', this.destroy.bind(this));
};


ProxyPipe.prototype._onSocketTimeout = function() {
    this.has_timed_out = true;
    debug('[KiwiProxy] IRC Timeout');
    this.irc_socket.destroy();
    this.kiwi_socket.write(new Buffer(RESPONSE_ETIMEDOUT.toString()), 'UTF8', this.destroy.bind(this));
};


ProxyPipe.prototype._onSocketClose = function() {
    debug('[KiwiProxy] IRC Socket closed');
    this.proxy_server.emit('connection_close', this);
    this.destroy();
};


ProxyPipe.prototype.startPiping = function() {
    debug('[KiwiProxy] ProxyPipe::startPiping()');

    // Let the piping handle socket closures
    this.irc_socket.removeAllListeners('error');
    this.irc_socket.removeAllListeners('timeout');

    this.irc_socket.on('close', this._onSocketClose.bind(this));

    this.kiwi_socket.setEncoding('binary');

    this.kiwi_socket.pipe(this.irc_socket);
    this.irc_socket.pipe(this.kiwi_socket);
};





/**
 * ProxySocket
 * Transparent socket interface to a kiwi proxy
 */
function ProxySocket(proxy_port, proxy_addr, meta, proxy_opts) {
    stream.Duplex.call(this);

    this.connected_fn = null;
    this.proxy_addr   = proxy_addr;
    this.proxy_port   = proxy_port;
    this.proxy_opts   = proxy_opts || {};

    this.setMeta(meta || {});

    this.state = 'disconnected';
}

util.inherits(ProxySocket, stream.Duplex);


ProxySocket.prototype.setMeta = function(meta) {
    this.meta = meta;
};


ProxySocket.prototype.connectTls = function() {
    this.meta.ssl = true;
    return this.connect.apply(this, arguments);
};


ProxySocket.prototype.connect = function(dest_port, dest_addr, connected_fn) {
    this.meta.host = dest_addr;
    this.meta.port = dest_port;
    this.connected_fn = connected_fn;

    if (!this.meta.host || !this.meta.port) {
        debug('[KiwiProxy] Invalid destination addr/port', this.meta);
        return false;
    }

    debug('[KiwiProxy] Connecting to proxy ' + this.proxy_addr + ':' + this.proxy_port.toString() + ' SSL: ' + (!!this.proxy_opts.ssl).toString());
    if (this.proxy_opts.ssl) {
        this.socket = tls.connect({
            port: this.proxy_port,
            host: this.proxy_addr,
            rejectUnauthorized: !!global.config.reject_unauthorised_certificates,
        }, this._onSocketConnect.bind(this));

    } else {
        this.socket = net.connect(this.proxy_port, this.proxy_addr, this._onSocketConnect.bind(this));
    }

    this.socket.setTimeout(10000);
    this.socket.on('data', this._onSocketData.bind(this));
    this.socket.on('close', this._onSocketClose.bind(this));
    this.socket.on('error', this._onSocketError.bind(this));

    return this;
};


ProxySocket.prototype.destroySocket = function() {
    if (!this.socket)
        return;

    this.socket.removeAllListeners();
    this.socket.destroy();
    delete this.socket;

    debug('[KiwiProxy] Destroying socket');
};


ProxySocket.prototype._read = function() {
    var data;

    if (this.state === 'connected' && this.socket) {
        while ((data = this.socket.read()) !== null) {
            if (this.push(data) === false) {
                break;
            }
        }
    } else {
        this.push('');
    }
};


ProxySocket.prototype._write = function(chunk, encoding, callback) {
    if (this.state === 'connected' && this.socket) {
        return this.socket.write(chunk, encoding, callback);
    } else {
        debug('[KiwiProxy] Trying to write to an unfinished socket. State=' + this.state);
        callback('Not connected');
    }
};


ProxySocket.prototype._onSocketConnect = function() {
    var meta = this.meta || {};

    this.state = 'handshaking';

    debug('[KiwiProxy] Connected to proxy, sending meta');
    this.socket.write(JSON.stringify(meta) + '\n');
};


ProxySocket.prototype._onSocketData = function(data) {
    if (this.state === 'connected') {
        this.emit('data', data);
        return;
    }

    var buffer_str = data.toString(),
        status = buffer_str[0],
        error_code,
        error_codes = {};

    error_codes[RESPONSE_ERROR]        = 'ERROR';
    error_codes[RESPONSE_ECONNRESET]   = 'ECONNRESET';
    error_codes[RESPONSE_ECONNREFUSED] = 'ECONNREFUSED';
    error_codes[RESPONSE_ENOTFOUND]    = 'ENOTFOUND';
    error_codes[RESPONSE_ETIMEDOUT]    = 'ETIMEDOUT';

    debug('[KiwiProxy] Recieved socket status: ' + data.toString());
    if (status === RESPONSE_OK) {
        debug('[KiwiProxy] Remote socket connected OK');
        this.state = 'connected';

        if (typeof this.connected_fn === 'function')
            connected_fn();

        this.emit('connect');

    } else {
        this.destroySocket();

        error_code = error_codes[status] || error_codes[RESPONSE_ERROR];
        debug('[KiwiProxy] Error: ' + error_code);
        this.emit('error', new Error(error_code));
    }
};


ProxySocket.prototype._onSocketClose = function(had_error) {
    debug('[KiwiProxy] _onSocketClose() had_error=' + had_error.toString());
    if (this.state === 'connected') {
        this.emit('close', had_error);
        return;
    }

    if (!this.ignore_close)
        this.emit('error', new Error(RESPONSE_ERROR));
};


ProxySocket.prototype._onSocketError = function(err) {
    debug('[KiwiProxy] _onSocketError() err=' + err.toString());
    this.ignore_close = true;
    this.emit('error', err);
};
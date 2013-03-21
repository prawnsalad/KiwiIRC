var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    EventEmitter    = require('events').EventEmitter,
    crypto          = require('crypto'),
    ipaddr          = require('ipaddr.js');
    
/*
 * API:
 * var s = new SocksConnection({host: irc.example.com, port: 6667, ssl: false}, {host: socks.example.net, port: 1080, user: null, pass: null});
 * s.on('connect', function (socket) {
 *     // send data to socket
 * });
 */

var SocksConnection = function (destination, socks) {
    var that = this;
    EventEmitter.call(this);
    
    this.remoteAddress = destination.host;
    this.remotePort = destination.port;
    this.ssl = destination.ssl;
    
    this.socksAddress = null;
    this.socksPort = null;
    
    this.socksSocket = net.connect({host: socks.host, port: socks.port}, socksConnected.bind(this, !(!socks.user)));
    this.socksSocket.once('data', socksAuth.bind(this, {user: socks.user || null, pass: socks.pass || null}));
    this.socksSocket.on('error', this._error);
};

util.inherits(SocksConnection, EventEmitter);

module.exports = SocksConnection;

SocksConnection.prototype.dispose = function () {
    this.socksSocket.destroy();
    this.removeAllListeners();
}

SocksConnection.prototype._error = function (err) {
    this.emit('error', err);
}

var socksConnected = function (auth) {
    if (auth) {
        this.socksSocket.write('\x05\x02\x02\x00'); // SOCKS version 5, supporting two auth methods
                                                    // username/password and 'no authentication'
    } else {
        this.socksSocket.write('\x05\x01\x00');     // SOCKS version 5, only supporting 'no auth' scheme
    }
};

var socksAuth = function (auth, data) {
    var bufs = [];
    switch (data.readUInt8(1)) {
    case 255:
        this.emit('error', 'SOCKS: No acceptable authentication methods');
        this.socksSocket.destroy();
        break;
    case 2:
        bufs[0] = new Buffer([1]);
        bufs[1] = new Buffer([Buffer.byteLength(auth.user)]);
        bufs[2] = new Buffer(auth.user);
        bufs[3] = new Buffer([Buffer.byteLength(auth.pass)]);
        bufs[4] = new Buffer(auth.pass);
        this.socksSocket.write(Buffer.concat(bufs));
        this.socksSocket.once('data', socksAuthStatus.bind(this));
        break;
    default:
        socksRequest.call(this, this.remoteAddress, this.remotePort);
    }
};

var socksAuthStatus = function (data) {
    if (data.readUInt8(1) === 1) {
        socksRequest.call(this, this.remoteHost, this.remotePort);
    } else {
        this.emit('error', 'SOCKS: Authentication failed');
        this.socksSocket.destroy();
    }
};

var socksRequest = function (host, port) {
    var header, type, hostBuf, portBuf;
    if (net.isIP(host)) {
        if (net.isIPv4(host)) {
            type = new Buffer([1]);
        } else if (net.isIPv6(host)) {
            type = new Buffer([4]);
        }
        host = new Buffer(ipaddr.parse(host).toByteArray());
    } else {
        type = new Buffer([3]);
        hostBuf = new Buffer(host);
        hostBuf = Buffer.concat([new Buffer([Buffer.byteLength(host)]), hostBuf]);
    }
    header = new Buffer([5, 1, 0]);
    portBuf = new Buffer(2);
    portBuf.writeUInt16BE(port, 0);
    this.socksSocket.write(Buffer.concat([header, type, hostBuf, portBuf]));
    this.socksSocket.once('data', socksReply.bind(this));
};

var socksReply = function (data) {
    var err, port, i, addr_len, addr = '';
    var status = data.readUInt8(1);
    if (status === 0) {
        switch (data.readUInt8(3)) {
        case 1:
            for (i = 0; i < 4; i++) {
                if (i !== 0) {
                    addr += '.';
                }
                addr += data.readUInt8(4 + i);
            }
            port = data.readUInt16BE(8);
            break;
        case 4:
            for (i = 0; i < 16; i++) {
                if (i !== 0) {
                    addr += ':';
                }
                addr += data.readUInt8(4 + i);
            }
            port = data.readUInt16BE(20);
            break;
        case 3:
            addr_len = data.readUInt8(4);
            addr = (data.slice(5, 5 + addr_len)).toString();
            port = data.readUInt16BE(5 + addr_len);
        }
        this.socksAddress = addr;
        this.socksPort = port;
        
        emitSocket.call(this);
        
    } else {
        switch (status) {
        case 1:
            err = 'SOCKS: general SOCKS server failure';
            break;
        case 2:
            err = 'SOCKS: Connection not allowed by ruleset';
            break;
        case 3:
            err = 'SOCKS: Network unreachable';
            break;
        case 4:
            err = 'SOCKS: Host unreachable';
            break;
        case 5:
            err = 'SOCKS: Connection refused';
            break;
        case 6:
            err = 'SOCKS: TTL expired';
            break;
        case 7:
            err = 'SOCKS: Command not supported';
            break;
        case 8:
            err = 'SOCKS: Address type not supported';
            break;
        default:
            err = 'SOCKS: Unknown error';
        }
        this.emit('error', err);
    }
};

var starttls = function () {
    var that = this;
    
    var pair = tls.createSecurePair(crypto.createCredentials(), false);
    pair.encrypted.pipe(this.socksSocket);
    this.socksSocket.pipe(pair.encrypted);
    
    pair.cleartext.socket = this.socksSocket;
    pair.cleartext.encrypted = pair.encrypted;
    pair.cleartext.authorised = false;
    
    pair.on('secure', function () { 
        that.emit('connect', pair.cleartext, this.socksSocket);
        that.socksSocket.removeListener('error', that._error);
    });
}

var emitSocket = function () {
    if (this.ssl) {
        starttls.call(this);
    } else {
        this.emit('connect', this.socksSocket);
        this.socksSocket.removeListener('error', this._error);
    }
};

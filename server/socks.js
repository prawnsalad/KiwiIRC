var stream  = require('stream'),
    util    = require('util'),
    net     = require('net'),
    tls     = require('tls'),
    _       = require('lodash'),
    ipaddr  = require('ipaddr.js');

var SocksConnection = function (remote_options, socks_options) {
    var that = this;
    stream.Duplex.call(this);
    
    this.remote_options = _.defaults(remote_options, {
        host: 'localhost',
        ssl: false,
        rejectUnauthorized: false
    });
    socks_options = _.defaults(socks_options, {
        host: 'localhost',
        port: 1080,
        user: null,
        pass: null
    });
    
    this.socksAddress = null;
    this.socksPort = null;
    
    this.socksSocket = net.connect({host: socks_options.host, port: socks_options.port}, socksConnected.bind(this, !(!socks_options.user)));
    this.socksSocket.once('data', socksAuth.bind(this, {user: socks_options.user, pass: socks_options.pass}));
    this.socksSocket.on('error', function (err) {
        that.emit('error', err);
    });
    
    this.outSocket = this.socksSocket;
};

util.inherits(SocksConnection, stream.Duplex);

SocksConnection.connect = function (remote_options, socks_options, connection_listener) {
    var socks_connection = new SocksConnection(remote_options, socks_options);
    if (typeof connection_listener === 'Function') {
        socks_connection.on('connect', connection_listener);
    }
    return socks_connection;
};

SocksConnection.prototype._read = function () {
    this.outSocket.resume();
};

SocksConnection.prototype._write = function (chunk, encoding, callback) {
    this.outSocket.write(chunk, 'utf8', callback);
};

SocksConnection.prototype.dispose = function () {
    this.outSocket.destroy();
    this.outSocket.removeAllListeners();
    if (this.outSocket !== this.socksSocket) {
        this.socksSocket.destroy();
        this.socksSocket.removeAllListeners();
    }
    this.removeAllListeners();
};

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
        socksRequest.call(this, this.remote_options.host, this.remote_options.port);
    }
};

var socksAuthStatus = function (data) {
    if (data.readUInt8(1) === 1) {
        socksRequest.call(this, this.remote_options.host, this.remote_options.port);
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
        
        if (this.remote_options.ssl) {
            startTLS.call(this);
        } else {
            proxyData.call(this);
            this.emit('connect');
        }
        
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

var startTLS = function () {
    var that = this;
    var plaintext = tls.connect({
        socket: this.socksSocket,
        rejectUnauthorized: this.rejectUnauthorized
    });
    
    plaintext.on('error', function (err) {
        that.emit('error', err);
    });
    
    plaintext.on('secureConnect', function () {
        that.emit('connect');
    });
    this.outSocket = plaintext;
    proxyData.call(this);
};

var proxyData = function () {
    var that = this;
    
    this.outSocket.on('data', function (data) {
        var buffer_not_full = that.push(data);
        if (!buffer_not_full) {
            this.pause();
        }
    });
    
    this.outSocket.on('end', function () {
        that.push(null);
    });
};

module.exports = SocksConnection;

var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    dns             = require('dns'),
    stream          = require('stream'),
    _               = require('lodash'),
    EventBinder     = require('./eventbinder.js'),
    IrcServer       = require('./server.js'),
    IrcCommands     = require('./commands.js'),
    IrcChannel      = require('./channel.js'),
    IrcUser         = require('./user.js'),
    IrcParser       = require('./parser.js'),
    EE              = require('../ee.js'),
    iconv           = require('iconv-lite'),
    Socks;


// Break the Node.js version down into usable parts
var version_values = process.version.substr(1).split('.').map(function (item) {
    return parseInt(item, 10);
});

// If we have a suitable Nodejs version, bring in the socks functionality
if (version_values[0] >= 0 && version_values[1] >= 10) {
    Socks = require('socksjs');
} else if (version_values[0] === 0 && version_values[1] >= 8) {
    // We're running 0.8, so bring in the streams2 polyfill
    stream = require('readable-stream');
}

var IrcConnection = function (hostname, port, ssl, nick, user, options, state, con_num) {
    var that = this;

    stream.Writable.call(this);
    EE.call(this,{
        wildcard: true,
        delimiter: ' '
    });
    this.setMaxListeners(0);

    options = options || {};

    // Socket state
    this.connected = false;

    // IRCd write buffers (flood controll)
    this.write_buffer = [];

    // In process of writing the buffer?
    this.writing_buffer = false;

    // Max number of lines to write a second
    this.write_buffer_lines_second = 2;

    // If registeration with the IRCd has completed
    this.registered = false;

    // If we are in the CAP negotiation stage
    this.cap_negotiation = true;

    // User information
    this.nick = nick;
    this.user = user;  // Contains users real hostname and address
    this.username = this.nick.replace(/[^0-9a-zA-Z\-_.\/]/, '');
    this.password = options.password || '';

    // Set the passed encoding. or the default if none giving or it fails
    if (!options.encoding || !this.setEncoding(options.encoding)) {
        this.setEncoding(global.config.default_encoding);
    }

    // State object
    this.state = state;

    // Connection ID in the state
    this.con_num = con_num;

    // IRC protocol handling
    this.irc_commands = new IrcCommands(this);

    // IrcServer object
    this.server = new IrcServer(this, hostname, port);

    // IrcUser objects
    this.irc_users = Object.create(null);

    // TODO: use `this.nick` instead of `'*'` when using an IrcUser per nick
    this.irc_users[this.nick] = new IrcUser(this, '*');

    // IrcChannel objects
    this.irc_channels = Object.create(null);

    // IRC connection information
    this.irc_host = {hostname: hostname, port: port};
    this.ssl = !(!ssl);

    // SOCKS proxy details
    // TODO: Wildcard matching of hostnames and/or CIDR ranges of IP addresses
    if ((global.config.socks_proxy && global.config.socks_proxy.enabled) && ((global.config.socks_proxy.all) || (_.contains(global.config.socks_proxy.proxy_hosts, this.irc_host.hostname)))) {
        this.socks = {
            host: global.config.socks_proxy.address,
            port: global.config.socks_proxy.port,
            user: global.config.socks_proxy.user,
            pass: global.config.socks_proxy.pass
        };
    } else {
        this.socks = false;
    }

    // Options sent by the IRCd
    this.options = Object.create(null);
    this.cap = {requested: [], enabled: []};

    // Is SASL supported on the IRCd
    this.sasl = false;

    this.parser = new IrcParser({ ircEncoding: this.irc_encoding });
    this.parser.pipe(that.irc_commands);
    this.parser.on('error', function (err) {
        that.emit('error', err);
        that.socket.destroy();
    });

    this.once('finish', function () {
        that.socket.end();
    });

    this.applyIrcEvents();
};

// Directly inherit from stream.Writable
util.inherits(IrcConnection, stream.Writable);
// Paracitically inhrit from EE
Object.keys(EE.prototype).forEach(function(method) {
    IrcConnection.prototype[method] = EE.prototype[method];
});

module.exports.IrcConnection = IrcConnection;



IrcConnection.prototype.applyIrcEvents = function () {
    // Listen for events on the IRC connection
    this.irc_events = {
        'server * connect':  onServerConnect,
        'channel * join':    onChannelJoin,

        // TODO: uncomment when using an IrcUser per nick
        //'user:*:privmsg':    onUserPrivmsg,
        'user * nick':       onUserNick,
        'channel * part':    onUserParts,
        'channel * quit':    onUserParts,
        'channel * kick':    onUserKick
    };

    EventBinder.bindIrcEvents('', this.irc_events, this, this);
};


/**
 * Start the connection to the IRCd
 */
IrcConnection.prototype.connect = function () {
    var that = this;

    // The socket connect event to listener for
    var socket_connect_event_name = 'connect';

    // The destination address
    var dest_addr = this.socks ?
        this.socks.host :
        this.irc_host.hostname;

    // Make sure we don't already have an open connection
    this.disposeSocket();

    // Get the IP family for the dest_addr (either socks or IRCd destination)
    getConnectionFamily(dest_addr, function getConnectionFamilyCb(err, family, host) {
        var outgoing;

        // Decide which net. interface to make the connection through
        if (global.config.outgoing_address) {
            if ((family === 'IPv6') && (global.config.outgoing_address.IPv6)) {
                outgoing = global.config.outgoing_address.IPv6;
            } else {
                outgoing = global.config.outgoing_address.IPv4 || '0.0.0.0';

                // We don't have an IPv6 interface but dest_addr may still resolve to
                // an IPv4 address. Reset `host` and try connecting anyway, letting it
                // fail if an IPv4 resolved address is not found
                host = dest_addr;
            }

            // If we have an array of interfaces, select a random one
            if (typeof outgoing !== 'string' && outgoing.length) {
                outgoing = outgoing[Math.floor(Math.random() * outgoing.length)];
            }

            // Make sure we have a valid interface address
            if (typeof outgoing !== 'string') {
                outgoing = '0.0.0.0';
            }

        } else {
            // No config was found so use the default
            outgoing = '0.0.0.0';
        }

        // Are we connecting through a SOCKS proxy?
        if (this.socks) {
            that.socket = Socks.connect({
                host: host,
                port: that.irc_host.port,
                ssl: that.ssl,
                rejectUnauthorized: global.config.reject_unauthorised_certificates
            }, {host: that.socks.host,
                port: that.socks.port,
                user: that.socks.user,
                pass: that.socks.pass,
                localAddress: outgoing
            });

        } else {
            // No socks connection, connect directly to the IRCd

            if (that.ssl) {
                that.socket = tls.connect({
                    host: host,
                    port: that.irc_host.port,
                    rejectUnauthorized: global.config.reject_unauthorised_certificates,
                    localAddress: outgoing
                });

                // We need the raw socket connect event
                that.socket.socket.on('connect', function() { rawSocketConnect.call(that, this); });

                socket_connect_event_name = 'secureConnect';

            } else {
                that.socket = net.connect({
                    host: host,
                    port: that.irc_host.port,
                    localAddress: outgoing
                });
            }
        }

        // Apply the socket listeners
        that.socket.on(socket_connect_event_name, function socketConnectCb() {

            // TLS connections have the actual socket as a property
            var is_tls = (typeof this.socket !== 'undefined') ?
                true :
                false;

            // TLS sockets have already called this
            if (!is_tls) {
                rawSocketConnect.call(that, this);
            }

            that.connected = true;

            socketConnectHandler.call(that);
        });

        that.socket.on('error', function socketErrorCb(event) {
            that.emit('error', event);
        });

        that.socket.on('close', function socketCloseCb(had_error) {
            that.connected = false;

            // Remove this socket form the identd lookup
            if (that.identd_port_pair) {
                delete global.clients.port_pairs[that.identd_port_pair];
            }

            that.emit('close', had_error);

            // Close the whole socket down
            that.disposeSocket();
        });

        that.socket.pipe(that.parser);
    });
};

/**
 * Send an event to the client
 */
IrcConnection.prototype.clientEvent = function (event_name, data, callback) {
    data.server = this.con_num;
    this.state.sendIrcCommand(event_name, data, callback);
};

/**
 * Write a line of data to the IRCd
 *
 * Overrides the stream.Writable.prototype#write method, but
 * stores a copy and utilises it when actually writing.
 *
 * @param data The line of data to be sent
 * @param force Write the data now, ignoring any write queue
 */
var oldWrite = IrcConnection.prototype.write;
IrcConnection.prototype.write = function (data, force) {
    if (force) {
        return oldWrite.call(this, data);
    }

    this.write_buffer.push(data);

    // Only flush if we're not writing already
    if (!this.writing_buffer) {
        return this.flushWriteBuffer();
    }

    return false;
};

IrcConnection.prototype._write = function (data, enc, callback) {
    //ENCOE string to encoding of the server
    var encoded_buffer = iconv.encode(data + '\r\n', this.irc_encoding);

    this.socket.write(encoded_buffer, callback);
};



/**
 * Flush the write buffer to the server in a throttled fashion
 */
IrcConnection.prototype.flushWriteBuffer = function () {
    var write_return;

    // In case the socket closed between writing our queue.. clean up
    if (!this.connected) {
        this.write_buffer = [];
        this.writing_buffer = false;
        return;
    }

    this.writing_buffer = true;

    // Disabled write buffer? Send everything we have
    if (!this.write_buffer_lines_second) {
        this.write_buffer.forEach(function(buffer) {
            write_return = this.write(buffer, true);
        });

        this.write_buffer = [];
        this.writing_buffer = false;

        return write_return;
    }

    // Nothing to write? Stop writing and leave
    if (this.write_buffer.length === 0) {
        this.writing_buffer = false;
        return true;
    }

    write_return = this.write(this.write_buffer.shift(), true);

    // Call this function again at some point if we still have data to write
    if (this.write_buffer.length > 0) {
        setTimeout(this.flushWriteBuffer.bind(this), 1000 / this.write_buffer_lines_second);
        return false;
    } else {
        // No more buffers to write.. so we've finished
        this.writing_buffer = false;
        return write_return;
    }
};


/**
 * Clean up this IrcConnection instance and any sockets
 */
IrcConnection.prototype.dispose = function () {
    // If we're still connected, wait until the socket is closed before disposing
    // so that all the events are still correctly triggered
    if (this.socket && this.connected) {
        this.end();
        return;
    }

    if (this.socket) {
        this.disposeSocket();
    }

    this.end();

    _.each(this.irc_users, function (user) {
        user.dispose();
    });
    _.each(this.irc_channels, function (chan) {
        chan.dispose();
    });
    this.irc_users = undefined;
    this.irc_channels = undefined;

    this.server.dispose();
    this.server = undefined;

    if (typeof this.parser.unpipe === 'function') {
        this.parser.unpipe(this.irc_commands);
    }
    this.parser = undefined;
    this.irc_commands = undefined;

    EventBinder.unbindIrcEvents('', this.irc_events, this);

    this.removeAllListeners();
};



/**
 * Clean up any sockets for this IrcConnection
 */
IrcConnection.prototype.disposeSocket = function () {
    if (this.socket) {
        this.socket.end();
        if (typeof this.socket.unpipe === 'function') {
            this.socket.unpipe();
        }
        this.socket.removeAllListeners();
        this.socket = null;
    }
};

/**
 * Set a new encoding for this connection
 * Return true in case of success
 */

IrcConnection.prototype.setEncoding = function (encoding) {
    var encoded_test;

    try {
        encoded_test = iconv.encode("TEST", encoding);
        //This test is done to check if this encoding also supports
        //the ASCII charset required by the IRC protocols
        //(Avoid the use of base64 or incompatible encodings)
        if (encoded_test === "TEST") {
            this.irc_encoding = encoding;
            this.parser.setIrcEncoding(encoding);
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

function getConnectionFamily(host, callback) {
    if (net.isIP(host)) {
        if (net.isIPv4(host)) {
            callback(null, 'IPv4', host);
        } else {
            callback(null, 'IPv6', host);
        }
    } else {
        dns.resolve6(host, function resolve6Cb(err, addresses) {
            if (!err) {
                callback(null, 'IPv6', addresses[0]);
            } else {
                dns.resolve4(host, function resolve4Cb(err, addresses) {
                    if (!err) {
                        callback(null, 'IPv4',addresses[0]);
                    } else {
                        callback(err);
                    }
                });
            }
        });
    }
}


function onChannelJoin(event) {
    var chan;

    // Only deal with ourselves joining a channel
    if (event.nick !== this.nick) {
        return;
    }

    // We should only ever get a JOIN command for a channel
    // we're not already a member of.. but check we don't
    // have this channel in case something went wrong somewhere
    // at an earlier point
    if (!this.irc_channels[event.channel]) {
        chan = new IrcChannel(this, event.channel);
        this.irc_channels[event.channel] = chan;
        chan.irc_events.join.call(chan, event);
    }
}


function onServerConnect(event) {
    this.nick = event.nick;
}


function onUserPrivmsg(event) {
    var user;

    // Only deal with messages targetted to us
    if (event.channel !== this.nick) {
        return;
    }

    if (!this.irc_users[event.nick]) {
        user = new IrcUser(this, event.nick);
        this.irc_users[event.nick] = user;
        user.irc_events.privmsg.call(user, event);
    }
}


function onUserNick(event) {
    // Only deal with messages targetted to us
    if (event.nick !== this.nick) {
        return;
    }

    this.nick = event.newnick;
}


function onUserParts(event) {
    // Only deal with ourselves leaving a channel
    if (event.nick !== this.nick) {
        return;
    }

    if (this.irc_channels[event.channel]) {
        this.irc_channels[event.channel].dispose();
        delete this.irc_channels[event.channel];
    }
}

function onUserKick(event){
    // Only deal with ourselves being kicked from a channel
    if (event.kicked !== this.nick){
        return;
    }
    if (this.irc_channels[event.channel]) {
        this.irc_channels[event.channel].dispose();
        delete this.irc_channels[event.channel];
    }

}



/**
 * When a socket connects to an IRCd
 * May be called before any socket handshake are complete (eg. TLS)
 */
var rawSocketConnect = function(socket) {
    // Make note of the port numbers for any identd lookups
    // Nodejs < 0.9.6 has no socket.localPort so check this first
    if (typeof socket.localPort !== 'undefined') {
        this.identd_port_pair = socket.localPort.toString() + '_' + socket.remotePort.toString();
        global.clients.port_pairs[this.identd_port_pair] = this;
    }
};


/**
 * Handle the socket connect event, starting the IRCd registration
 */
var socketConnectHandler = function () {
    var that = this,
        connect_data;

    // Build up data to be used for webirc/etc detection
    connect_data = {
        connection: this,

        // Array of lines to be sent to the IRCd before anything else
        prepend_data: []
    };

    // Let the webirc/etc detection modify any required parameters
    connect_data = findWebIrc.call(this, connect_data);

    global.modules.emit('irc authorize', connect_data).done(function ircAuthorizeCb() {
        var gecos = '[www.kiwiirc.com] ' + that.nick;

        if (global.config.default_gecos) {
            gecos = global.config.default_gecos.toString().replace('%n', that.nick);
        }

        // Send any initial data for webirc/etc
        if (connect_data.prepend_data) {
            _.each(connect_data.prepend_data, function(data) {
                that.write(data);
            });
        }

        that.write('CAP LS');

        if (that.password) {
            that.write('PASS ' + that.password);
        }

        that.write('NICK ' + that.nick);
        that.write('USER ' + that.username + ' 0 0 :' + gecos);

        that.emit('connected');
    });
};



/**
 * Load any WEBIRC or alternative settings for this connection
 * Called in scope of the IrcConnection instance
 */
function findWebIrc(connect_data) {
    var webirc_pass = global.config.webirc_pass,
        ip_as_username = global.config.ip_as_username,
        tmp;


    // Do we have a WEBIRC password for this?
    if (webirc_pass && webirc_pass[this.irc_host.hostname]) {
        // Build the WEBIRC line to be sent before IRC registration
        tmp = 'WEBIRC ' + webirc_pass[this.irc_host.hostname] + ' KiwiIRC ';
        tmp += this.user.hostname + ' ' + this.user.address;

        connect_data.prepend_data = [tmp];
    }


    // Check if we need to pass the users IP as its username/ident
    if (ip_as_username && ip_as_username.indexOf(this.irc_host.hostname) > -1) {
        // Get a hex value of the clients IP
        this.username = this.user.address.split('.').map(function ipSplitMapCb(i, idx){
            var hex = parseInt(i, 10).toString(16);

            // Pad out the hex value if it's a single char
            if (hex.length === 1) {
                hex = '0' + hex;
            }

            return hex;
        }).join('');

    }

    return connect_data;
}

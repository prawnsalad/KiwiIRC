var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    dns             = require('dns'),
    _               = require('lodash'),
    winston         = require('winston'),
    crypto          = require('crypto'),
    Socks           = require('socksjs'),
    EventBinder     = require('./eventbinder.js'),
    IrcServer       = require('./server.js'),
    IrcCommands     = require('./commands.js'),
    IrcChannel      = require('./channel.js'),
    IrcUser         = require('./user.js'),
    EE              = require('../ee.js'),
    iconv           = require('iconv-lite'),
    Proxy           = require('../proxy.js'),
    Stats           = require('../stats.js');


var next_connection_id = 1;
function generateConnectionId() {
    return next_connection_id++;
}

var IrcConnection = function (hostname, port, ssl, nick, user, options, state, con_num) {
    EE.call(this,{
        wildcard: true,
        delimiter: ' '
    });
    this.setMaxListeners(0);

    Stats.incr('irc.connection.created');

    options = options || {};

    // An ID to identify this connection instance
    this.id = generateConnectionId();

    // All setInterval/setTimeout values relating to this connection will be
    // added here. Keeps it easier to clearTimeout() them all during cleanup.
    this._timers = [];

    // Socket state
    this.connected = false;

    // If the connection closes and this is false, we reconnect
    this.requested_disconnect = false;

    // Number of times we have tried to reconnect
    this.reconnect_attempts = 0;

    // Last few lines from the IRCd for context when disconnected (server errors, etc)
    this.last_few_lines = [];

    // IRCd message buffers
    this.read_buffer = [];

    // In process of reading the IRCd messages?
    this.reading_buffer = false;

    // IRCd write buffers (flood controll)
    this.write_buffer = [];

    // In process of writing the buffer?
    this.writing_buffer = false;

    // Max number of lines to write a second
    this.write_buffer_lines_second = 2;

    // If we are in the CAP negotiation stage
    this.cap_negotiation = true;

    // User information
    this.nick = nick;
    this.user = user;  // Contains users real hostname and address
    this.username = ''; // Uses default from config if empty
    this.gecos = ''; // Users real-name. Uses default from config if empty
    this.password = options.password || '';
    this.quit_message = ''; // Uses default from config if empty

    // Set the passed encoding. or the default if none giving or it fails
    if (!options.encoding || !this.setEncoding(options.encoding)) {
        this.setEncoding(global.config.default_encoding);
    }

    // State object
    this.state = state;

    // Connection ID in the state
    this.con_num = con_num;

    // IRC protocol handling
    this.irc_commands = new IrcCommands.Handler(this);

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

    // Kiwi proxy info may be set within a server module. {port: 7779, host: 'kiwi.proxy.com', ssl: false}
    this.proxy = false;

    // Net. interface this connection should be made through
    this.outgoing_interface = false;

    // Options sent by the IRCd
    this.options = Object.create(null);
    this.options.PREFIX = [
        {symbol: '~', mode: 'q'},
        {symbol: '&', mode: 'a'},
        {symbol: '@', mode: 'o'},
        {symbol: '%', mode: 'h'},
        {symbol: '+', mode: 'v'}
    ];

    this.cap = {requested: [], enabled: []};

    // Is SASL supported on the IRCd
    this.sasl = false;

    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = null;

    this.applyIrcEvents();
};
util.inherits(IrcConnection, EE);

module.exports.IrcConnection = IrcConnection;



/**
 * Create and keep track of all timers so they can be easily removed
 */
IrcConnection.prototype.setTimeout = function(fn, length /*, argN */) {
    var tmr = setTimeout.apply(null, arguments);
    this._timers.push(tmr);
    return tmr;
};

IrcConnection.prototype.clearTimers = function() {
    this._timers.forEach(function(tmr) {
        clearTimeout(tmr);
    });
};



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
    var dest_addr;
    if (this.socks) {
        dest_addr = this.socks.host;
    } else if (this.proxy) {
        dest_addr = this.proxy.host;
    } else {
        dest_addr = this.irc_host.hostname;
    }

    // Make sure we don't already have an open connection
    this.disposeSocket();

    this.requested_disconnect = false;

    // Make sure we have the username and gecos configured
    this.setDefaultUserDetails();

    // Get the IP family for the dest_addr (either socks or IRCd destination)
    getConnectionFamily(dest_addr, function getConnectionFamilyCb(err, family, host) {
        var outgoing;

        // Decide which net. interface to make the connection through
        if (that.outgoing_interface) {
            // An specific interface has been given for this connection
            outgoing = this.outgoing_interface;

        } else if (global.config.outgoing_address) {
            // Pick an interface from the config
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
        if (that.socks) {
            that.socket = Socks.connect({
                host: that.irc_host.host,
                port: that.irc_host.port,
                ssl: that.ssl,
                rejectUnauthorized: global.config.reject_unauthorised_certificates
            }, {host: host,
                port: that.socks.port,
                user: that.socks.user,
                pass: that.socks.pass,
                localAddress: outgoing
            });

        } else if (that.proxy) {
            that.socket = new Proxy.ProxySocket(that.proxy.port, host, {
                username: that.username,
                interface: that.proxy.interface
            }, {ssl: that.proxy.ssl});

            if (that.ssl) {
                that.socket.connectTls(that.irc_host.port, that.irc_host.hostname);
            } else {
                that.socket.connect(that.irc_host.port, that.irc_host.hostname);
            }

        } else {
            // No socks connection, connect directly to the IRCd

            if (that.ssl) {
                that.socket = tls.connect({
                    host: host,
                    port: that.irc_host.port,
                    rejectUnauthorized: global.config.reject_unauthorised_certificates,
                    localAddress: outgoing
                });

                // We need the raw socket connect event.
                // node.js 0.12 no longer has a .socket property.
                (that.socket.socket || that.socket).on('connect', function() {
                    rawSocketConnect.call(that, this);
                });

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

            winston.debug('(connection ' + that.id + ') Socket connected');
            Stats.incr('irc.connection.connected');
            that.connected = true;

            socketConnectHandler.call(that);
        });

        that.socket.on('error', function socketErrorCb(event) {
            that.emit('error', event);
        });

        that.socket.on('data', function () {
            socketOnData.apply(that, arguments);
        });

        that.socket.on('close', function socketCloseCb(had_error) {
            // If that.connected is false, we never actually managed to connect
            var was_connected = that.connected,
                safely_registered = true,
                should_reconnect = false;

            // Safely registered = was registered on IRC network for at least 10secs
            safely_registered = that.server.registered !== false && (Date.now()) - that.server.registered > 10000;

            winston.debug('(connection ' + that.id + ') Socket closed');
            that.connected = false;
            that.server.reset();

            // Remove this socket form the identd lookup
            if (that.identd_port_pair) {
                delete global.clients.port_pairs[that.identd_port_pair];
            }

            // Close the whole socket down
            that.disposeSocket();

            if (!global.config.ircd_reconnect || that.requested_disconnect) {
                Stats.incr('irc.connection.closed');
                that.emit('close', had_error);

            } else {
                // If trying to reconnect, continue with it
                if (that.reconnect_attempts && that.reconnect_attempts < 3) {
                    should_reconnect = true;

                // If we were originally connected OK, reconnect
                } else if (was_connected && safely_registered) {
                    should_reconnect = true;

                } else {
                    should_reconnect = false;
                }

                if (should_reconnect) {
                    winston.debug('(connection ' + that.id + ') Socket reconnecting');
                    Stats.incr('irc.connection.reconnect');
                    that.reconnect_attempts++;
                    that.emit('reconnecting');
                } else {
                    Stats.incr('irc.connection.closed');
                    that.emit('close', had_error);
                    that.reconnect_attempts = 0;
                }

                // If this socket closing was not expected and we did actually connect and
                // we did previously completely register on the network, then reconnect
                if (should_reconnect) {
                    that.setTimeout(function() {
                        that.connect();
                    }, 4000);
                }
            }
        });
    });
};

/**
 * Send an event to the client
 */
IrcConnection.prototype.clientEvent = function (event_name, data, callback) {
    data.connection_id = this.con_num;
    this.state.sendIrcCommand(event_name, data, callback);
};

/**
 * Write a line of data to the IRCd
 * @param data The line of data to be sent
 * @param force Write the data now, ignoring any write queue
 */
IrcConnection.prototype.write = function (data, force, force_complete_fn) {
    //ENCODE string to encoding of the server
    var encoded_buffer = iconv.encode(data + '\r\n', this.encoding);

    if (force) {
        this.socket && this.socket.write(encoded_buffer, force_complete_fn);
        winston.debug('(connection ' + this.id + ') Raw C:', data);
        return;
    }

    winston.debug('(connection ' + this.id + ') Raw C:', data);
    this.write_buffer.push(encoded_buffer);

    // Only flush if we're not writing already
    if (!this.writing_buffer) {
        this.flushWriteBuffer();
    }
};



/**
 * Flush the write buffer to the server in a throttled fashion
 */
IrcConnection.prototype.flushWriteBuffer = function () {

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
            this.socket && this.socket.write(buffer);
            this.write_buffer = null;
        });

        this.write_buffer = [];
        this.writing_buffer = false;

        return;
    }

    // Nothing to write? Stop writing and leave
    if (this.write_buffer.length === 0) {
        this.writing_buffer = false;
        return;
    }

    this.socket && this.socket.write(this.write_buffer[0]);
    this.write_buffer = this.write_buffer.slice(1);

    // Call this function again at some point if we still have data to write
    if (this.write_buffer.length > 0) {
        that.setTimeout(this.flushWriteBuffer.bind(this), 1000 / this.write_buffer_lines_second);
    } else {
        // No more buffers to write.. so we've finished
        this.writing_buffer = false;
    }
};



/**
 * Close the connection to the IRCd after forcing one last line
 */
IrcConnection.prototype.end = function (data) {
    var that = this;

    if (!this.socket) {
        return;
    }

    this.requested_disconnect = true;

    if (this.connected && data) {
        // Once the last bit of data has been sent, then re-run this function to close the socket
        this.write(data, true, function() {
            that.end();
        });

        return;
    }

    this.socket.destroy();
};



/**
 * Check if any server capabilities are enabled
 */
IrcConnection.prototype.capContainsAny = function (caps) {
    var enabled_caps;

    if (!caps instanceof Array) {
        caps = [caps];
    }

    enabled_caps = _.intersection(this.cap.enabled, caps);
    return enabled_caps.length > 0;
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

    this.irc_commands = undefined;

    EventBinder.unbindIrcEvents('', this.irc_events, this);

    this.clearTimers();
    this.removeAllListeners();
};



/**
 * Clean up any sockets for this IrcConnection
 */
IrcConnection.prototype.disposeSocket = function () {
    if (this.socket) {
        this.socket.end();
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
        if (encoded_test == "TEST") { // jshint ignore:line
            this.encoding = encoding;
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};



/**
 * Set the defeault username and gecos values if we don't have them already
 */
IrcConnection.prototype.setDefaultUserDetails = function () {
    this.username = (this.username || global.config.default_ident || '%n')
        .replace('%n', (this.nick.replace(/[^0-9a-zA-Z\-_.\/]/, '') || 'nick'))
        .replace('%h', this.user.hostname)
        .replace('%i', getIpIdent(this.user.address));

    this.gecos = (this.gecos || global.config.default_gecos || '%n')
        .replace('%n', this.nick)
        .replace('%h', this.user.hostname);
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
    if (event.kicked !== this.nick) {
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

    global.modules.emit('irc authorize', connect_data).then(function ircAuthorizeCb() {
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
        that.write('USER ' + that.username + ' 0 0 :' + that.gecos);

        that.emit('connected');
    });
};


// Convert a IPv4-mapped IPv6 addresses to a regular IPv4 address
function unmapIPv4(address) {
    if (address.toLowerCase().indexOf('::ffff:') == 0) {
        address = address.substring(7);
    }
    return address
}


/**
 * Load any WEBIRC or alternative settings for this connection
 * Called in scope of the IrcConnection instance
 */
function findWebIrc(connect_data) {
    var webirc_pass = global.config.webirc_pass,
        address = unmapIPv4(this.user.address),
        found_webirc_pass, tmp;

    // Do we have a single WEBIRC password?
    if (typeof webirc_pass === 'string' && webirc_pass) {
        found_webirc_pass = webirc_pass;

    // Do we have a WEBIRC password for this hostname?
    } else if (typeof webirc_pass === 'object' && webirc_pass[this.irc_host.hostname.toLowerCase()]) {
        found_webirc_pass = webirc_pass[this.irc_host.hostname.toLowerCase()];
    }

    if (found_webirc_pass) {
        // Build the WEBIRC line to be sent before IRC registration
        tmp = 'WEBIRC ' + found_webirc_pass + ' KiwiIRC ';
        var hostname = this.user.hostname;
        // Add a 0 in front of IP(v6) addresses starting with a colon
        // (otherwise the colon will be interpreted as meaning that the
        // rest of the line is a single argument).
        if (hostname[0] == ':') hostname = '0' + hostname;
        if (address[0] == ':') address = '0' + address;
        tmp += hostname + ' ' + address;

        connect_data.prepend_data = [tmp];
    }

    return connect_data;
}


/**
 * Buffer any data we get from the IRCd until we have complete lines.
 */
function socketOnData(data) {
    var data_pos,               // Current position within the data Buffer
        line_start = 0,
        lines = [],
        i,
        max_buffer_size = 1024; // 1024 bytes is the maximum length of two RFC1459 IRC messages.
                                // May need tweaking when IRCv3 message tags are more widespread

    // Split data chunk into individual lines
    for (data_pos = 0; data_pos < data.length; data_pos++) {
        if (data[data_pos] === 0x0A) { // Check if byte is a line feed
            lines.push(data.slice(line_start, data_pos));
            line_start = data_pos + 1;
        }
    }

    // No complete lines of data? Check to see if buffering the data would exceed the max buffer size
    if (!lines[0]) {
        if ((this.held_data ? this.held_data.length : 0 ) + data.length > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
            this.socket.destroy();

        } else {

            // Append the incomplete line to our held_data and wait for more
            if (this.held_data) {
                this.held_data = Buffer.concat([this.held_data, data], this.held_data.length + data.length);
            } else {
                this.held_data = data;
            }
        }

        // No complete lines to process..
        return;
    }

    // If we have an incomplete line held from the previous chunk of data
    // merge it with the first line from this chunk of data
    if (this.hold_last && this.held_data !== null) {
        lines[0] = Buffer.concat([this.held_data, lines[0]], this.held_data.length + lines[0].length);
        this.hold_last = false;
        this.held_data = null;
    }

    // If the last line of data in this chunk is not complete, hold it so
    // it can be merged with the first line from the next chunk
    if (line_start < data_pos) {
        if ((data.length - line_start) > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
            this.socket.destroy();
            return;
        }

        this.hold_last = true;
        this.held_data = new Buffer(data.length - line_start);
        data.copy(this.held_data, 0, line_start);
    }

    this.read_buffer = this.read_buffer.concat(lines);
    processIrcLines(this);
}


// Encodes a Buffer of bytes into an RFC 4648 base32 encoded string.
// Does not include padding.
// From https://github.com/agnoster/base32-js
function base32Encode(input) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var skip = 0;  // How many bits we will skip from the first byte
    var bits = 0;  // 5 high bits, carry from one byte to the next
    var output = '';

    for (var i = 0; i < input.length; ) {
        var byte = input[i];
        if (skip < 0) {  // We have a carry from the previous byte
            bits |= byte >> (-skip);
        } else {  // No carry
            bits = (byte << skip) & 0xF8;  // 0b11111000
        }

        if (skip > 3) {
            // Not enough data to produce a character, get us another one
            skip -= 8;
            ++i;
            continue;
        }

        if (skip < 4) {
            // Produce a character
            output += alphabet[bits >> 3];
            skip += 5;
        }
    }

    return output + (skip < 0 ? alphabet[bits >> 3] : '');
}


function getIpIdent(ip) {
    ip = unmapIPv4(ip);
    if (ip.indexOf('.') != -1) {  // IPv4
        // With IPv4 addresses we can just encode the address in hex
        return ip.split('.').map(function ipSplitMapCb(i, idx) {
            var hex = parseInt(i, 10).toString(16);

            // Pad out the hex value if it's a single char
            if (hex.length === 1)
                hex = '0' + hex;

            return hex;
        }).join('');
    } else {  // IPv6
        // Generate a hash of the IP address and encode it in base-32.  This
        // can have collisions, but the probability should be very low (about
        // 1 / 32^x, where x is the max ident length).  Why base32?  Because
        // the ident is compared case-insensitively in hostmasks and is used by
        // humans who may confuse similar characters.
        return base32Encode(crypto.createHash('sha1')
                .update(ip).digest()).substr(0, 10);
    }
}



/**
 * Process the messages recieved from the IRCd that are buffered on an IrcConnection object
 * Will only process 4 lines per JS tick so that node can handle any other events while
 * handling a large buffer
 */
function processIrcLines(irc_con, continue_processing) {
    if (irc_con.reading_buffer && !continue_processing) return;
    irc_con.reading_buffer = true;

    var lines_per_js_tick = 4,
        processed_lines = 0;

    while(processed_lines < lines_per_js_tick && irc_con.read_buffer.length > 0) {
        parseIrcLine(irc_con, irc_con.read_buffer.shift());
        processed_lines++;
        Stats.incr('irc.connection.parsed_lines');
    }

    if (irc_con.read_buffer.length > 0) {
        irc_con.setTimeout(processIrcLines, 1, irc_con, true);
    } else {
        irc_con.reading_buffer = false;
    }
}



/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:@([^ ]+) )?):(?:([^\s!]+)|([^\s!]+)!([^\s@]+)@?([^\s]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.*))?$/i;

function parseIrcLine(irc_con, buffer_line) {
    var msg,
        i,
        tags = [],
        tag,
        line = '',
        msg_obj,
        hold_last_lines;

    // Decode server encoding
    line = iconv.decode(buffer_line, irc_con.encoding);
    if (!line) {
        return;
    }

    // Parse the complete line, removing any carriage returns
    msg = parse_regex.exec(line.replace(/^\r+|\r+$/, ''));

    winston.debug('(connection ' + irc_con.id + ') Raw S:', line.replace(/^\r+|\r+$/, ''));

    if (!msg) {
        // The line was not parsed correctly, must be malformed
        winston.warn('Malformed IRC line: %s', line.replace(/^\r+|\r+$/, ''));
        return;
    }

    // If enabled, keep hold of the last X lines
    if (global.config.hold_ircd_lines) {
        irc_con.last_few_lines.push(line.replace(/^\r+|\r+$/, ''));

        // Trim the array down if it's getting to long. (max 3 by default)
        hold_last_lines = parseInt(global.config.hold_ircd_lines, 10) || 3;

        if (irc_con.last_few_lines.length > hold_last_lines) {
            irc_con.last_few_lines = irc_con.last_few_lines.slice(irc_con.last_few_lines.length - hold_last_lines);
        }
    }

    // Extract any tags (msg[1])
    if (msg[1]) {
        tags = msg[1].split(';');

        for (i = 0; i < tags.length; i++) {
            tag = tags[i].split('=');
            tags[i] = {tag: tag[0], value: tag[1]};
        }
    }

    msg_obj = {
        tags:       tags,
        prefix:     msg[2],
        nick:       msg[3] || msg[2],  // Nick will be in the prefix slot if a full user mask is not used
        ident:      msg[4] || '',
        hostname:   msg[5] || '',
        command:    msg[6],
        params:     msg[7] ? msg[7].split(/ +/) : []
    };

    if (msg[8]) {
        msg_obj.params.push(msg[8].trimRight());
    }

    irc_con.irc_commands.dispatch(new IrcCommands.Command(msg_obj.command.toUpperCase(), msg_obj));
}

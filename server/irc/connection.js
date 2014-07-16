var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    dns             = require('dns'),
    _               = require('lodash'),
    winston         = require('winston'),
    EventBinder     = require('./eventbinder.js'),
    IrcServer       = require('./server.js'),
    IrcCommands     = require('./commands.js'),
    IrcChannel      = require('./channel.js'),
    IrcUser         = require('./user.js'),
    EE              = require('../ee.js'),
    iconv           = require('iconv-lite'),
    Proxy           = require('../proxy.js'),
    Socks;


// Break the Node.js version down into usable parts
var version_values = process.version.substr(1).split('.').map(function (item) {
    return parseInt(item, 10);
});

// If we have a suitable Nodejs version, bring in the SOCKS functionality
if (version_values[1] >= 10) {
    Socks = require('socksjs');
}

var IrcConnection = function (hostname, port, ssl, nick, user, options, state, con_num) {
    EE.call(this,{
        wildcard: true,
        delimiter: ' '
    });
    this.setMaxListeners(0);

    options = options || {};

    // Socket state
    this.connected = false;

    // If the connection closes and this is false, we reconnect
    this.requested_disconnect = false;

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
    this.gecos = ''; // Users real-name. Uses default from config if empty
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

        that.socket.on('data', function () {
            socketOnData.apply(that, arguments);
        });

        that.socket.on('close', function socketCloseCb(had_error) {
            // If that.connected is false, we never actually managed to connect
            var was_connected = that.connected,
                had_registered = that.server.registered,
                should_reconnect = false;

            that.connected = false;
            that.server.reset();

            // Remove this socket form the identd lookup
            if (that.identd_port_pair) {
                delete global.clients.port_pairs[that.identd_port_pair];
            }

            should_reconnect = (!that.requested_disconnect && was_connected && had_registered);

            if (should_reconnect) {
                that.emit('reconnecting');
            } else {
                that.emit('close', had_error);
            }

            // Close the whole socket down
            that.disposeSocket();

            // If this socket closing was not expected and we did actually connect and
            // we did previously completely register on the network, then reconnect
            if (should_reconnect) {
                setTimeout(function() {
                    that.connect();
                }, 3000);
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
IrcConnection.prototype.write = function (data, force) {
    //ENCODE string to encoding of the server
    var encoded_buffer = iconv.encode(data + '\r\n', this.encoding);

    if (force) {
        this.socket.write(encoded_buffer);
        return;
    }

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
            this.socket.write(buffer);
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

    this.socket.write(this.write_buffer[0]);
    this.write_buffer = this.write_buffer.slice(1);

    // Call this function again at some point if we still have data to write
    if (this.write_buffer.length > 0) {
        setTimeout(this.flushWriteBuffer.bind(this), 1000 / this.write_buffer_lines_second);
    } else {
        // No more buffers to write.. so we've finished
        this.writing_buffer = false;
    }
};



/**
 * Close the connection to the IRCd after forcing one last line
 */
IrcConnection.prototype.end = function (data) {
    if (!this.socket) {
        return;
    }

    this.requested_disconnect = true;

    if (data) {
        this.write(data, true);
    }

    this.socket.end();
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

    global.modules.emit('irc authorize', connect_data).done(function ircAuthorizeCb() {
        var gecos = that.gecos;

        if (!gecos && global.config.default_gecos) {
            // We don't have a gecos yet, so use the default
            gecos = global.config.default_gecos.toString().replace('%n', that.nick);
            gecos = gecos.replace('%h', that.user.hostname);

        } else if (!gecos) {
            // We don't have a gecos nor a default, so lets set somthing
            gecos = '[www.kiwiirc.com] ' + that.nick;
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
        this.username = this.user.address.split('.').map(function ipSplitMapCb(i){
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

    // Process our data line by line
    for (i = 0; i < lines.length; i++) {
        parseIrcLine.call(this, lines[i]);
    }

}



/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:@([^ ]+) )?):(?:([^\s!]+)|([^\s!]+)!([^\s@]+)@?([^\s]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.*))?$/i;

function parseIrcLine(buffer_line) {
    var msg,
        i,
        tags = [],
        tag,
        line = '',
        msg_obj;

    // Decode server encoding
    line = iconv.decode(buffer_line, this.encoding);
    if (!line) {
        return;
    }

    // Parse the complete line, removing any carriage returns
    msg = parse_regex.exec(line.replace(/^\r+|\r+$/, ''));

    if (!msg) {
        // The line was not parsed correctly, must be malformed
        winston.warn('Malformed IRC line: %s', line.replace(/^\r+|\r+$/, ''));
        return;
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
        nick:       msg[3],
        ident:      msg[4],
        hostname:   msg[5] || '',
        command:    msg[6],
        params:     msg[7] ? msg[7].split(/ +/) : []
    };

    if (msg[8]) {
        msg_obj.params.push(msg[8].trim());
    }

    this.irc_commands.dispatch(new IrcCommands.Command(msg_obj.command.toUpperCase(), msg_obj));
}

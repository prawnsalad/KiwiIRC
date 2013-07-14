var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    dns             = require('dns'),
    _               = require('lodash'),
    EventBinder     = require('./eventbinder.js'),
    IrcServer       = require('./server.js'),
    IrcChannel      = require('./channel.js'),
    IrcUser         = require('./user.js'),
    EE              = require('../ee.js'),
    iconv           = require('iconv-lite'),
    Socks;


// Break the Node.js version down into usable parts
var version_values = process.version.substr(1).split('.').map(function (item) {
    return parseInt(item, 10);
});

// If we have a suitable Nodejs version, bring int he socks functionality
if (version_values[1] >= 10) {
    Socks = require('socksjs');
}

var IrcConnection = function (hostname, port, ssl, nick, user, pass, state) {
    var that = this;

    EE.call(this,{
        wildcard: true,
        delimiter: ' '
    });
    this.setMaxListeners(0);

    // Set the first configured encoding as the default encoding
    this.encoding = global.config.default_encoding;
    
    // Socket state
    this.connected = false;

    // If registeration with the IRCd has completed
    this.registered = false;

    // If we are in the CAP negotiation stage
    this.cap_negotiation = true;

    // User information
    this.nick = nick;
    this.user = user;  // Contains users real hostname and address
    this.username = this.nick.replace(/[^0-9a-zA-Z\-_.\/]/, '');
    this.password = pass;

    // State object
    this.state = state;

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

    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = '';

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
    var dest_addr = this.socks ?
        this.socks.host :
        this.irc_host.hostname;

    // Make sure we don't already have an open connection
    this.disposeSocket();

    // Get the IP family for the dest_addr (either socks or IRCd destination)
    getConnectionFamily(dest_addr, function (err, family, host) {
        var outgoing;

        // Decide which net. interface to make the connection through
        if (global.config.outgoing_address) {
            if ((family === 'IPv6') && (global.config.outgoing_address.IPv6)) {
                outgoing = global.config.outgoing_address.IPv6;
            } else {
                outgoing = global.config.outgoing_address.IPv4 || '0.0.0.0';
            }

        } else {
            // No config was found so use the default
            outgoing = '0.0.0.0';
        }

        // Are we connecting through a SOCKS proxy?
        if (this.socks) {
            that.socket = Socks.connect({
                host: that.irc_host.hostname,
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
                    host: that.irc_host.hostname,
                    port: that.irc_host.port,
                    rejectUnauthorized: global.config.reject_unauthorised_certificates,
                    localAddress: outgoing
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
        that.socket.on(socket_connect_event_name, function () {
            that.connected = true;
            socketConnectHandler.call(that);
        });

        that.socket.on('error', function (event) {
            that.emit('error', event);
        });

        that.socket.on('data', function () {
            parse.apply(that, arguments);
        });

        that.socket.on('close', function (had_error) {
            that.connected = false;
            that.emit('close');

            // Close the whole socket down
            that.disposeSocket();
        });
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
 */
IrcConnection.prototype.write = function (data, callback) {
    //ENCODE string to encoding of the server
    encoded_buffer = iconv.encode(data + '\r\n', this.encoding);
    this.socket.write(encoded_buffer);
};



/**
 * Close the connection to the IRCd after sending one last line
 */
IrcConnection.prototype.end = function (data, callback) {
    if (data)
        this.write(data);

    this.socket.end();
};



/**
 * Clean up this IrcConnection instance and any sockets
 */
IrcConnection.prototype.dispose = function () {
    var that = this;

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

    EventBinder.unbindIrcEvents('', this.irc_events, this);

    // If we're still connected, wait until the socket is closed before disposing
    // so that all the events are still correctly triggered
    if (this.socket && this.connected) {
        this.socket.once('close', function() {
            that.disposeSocket();
            that.removeAllListeners();
        });

        this.socket.end();

    } else {
        this.disposeSocket();
        this.removeAllListeners();
    }
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
        if (encoded_test == "TEST") {
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
            setImmediate(callback, null, 'IPv4', host);
        } else {
            setImmediate(callback, null, 'IPv6', host);
        }
    } else {
        dns.resolve6(host, function (err, addresses) {
            if (!err) {
                callback(null, 'IPv6', addresses[0]);
            } else {
                dns.resolve4(host, function (err, addresses) {
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
    if (event.nick !== this.nick)
        return;

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
    if (event.channel !== this.nick)
        return;

    if (!this.irc_users[event.nick]) {
        user = new IrcUser(this, event.nick);
        this.irc_users[event.nick] = user;
        user.irc_events.privmsg.call(user, event);
    }
}


function onUserNick(event) {
    var user;

    // Only deal with messages targetted to us
    if (event.nick !== this.nick)
        return;

    this.nick = event.newnick;
}


function onUserParts(event) {
    // Only deal with ourselves leaving a channel
    if (event.nick !== this.nick)
        return;

    if (this.irc_channels[event.channel]) {
        this.irc_channels[event.channel].dispose();
        delete this.irc_channels[event.channel];
    }
}

function onUserKick(event){
    // Only deal with ourselves being kicked from a channel
    if (event.kicked !== this.nick)
        return;

    if (this.irc_channels[event.channel]) {
        this.irc_channels[event.channel].dispose();
        delete this.irc_channels[event.channel];
    }

}




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

    global.modules.emit('irc authorize', connect_data).done(function () {
        // Send any initial data for webirc/etc
        if (connect_data.prepend_data) {
            _.each(connect_data.prepend_data, function(data) {
                that.write(data);
            });
        }

        that.write('CAP LS');

        if (that.password)
            that.write('PASS ' + that.password);

        that.write('NICK ' + that.nick);
        that.write('USER ' + that.username + ' 0 0 :' + '[www.kiwiirc.com] ' + that.nick);

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
        this.username = this.user.address.split('.').map(function(i, idx){
            var hex = parseInt(i, 10).toString(16);

            // Pad out the hex value if it's a single char
            if (hex.length === 1)
                hex = '0' + hex;

            return hex;
        }).join('');

    }

    return connect_data;
}



/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:(@[^ ]+) )?):(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-*]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-*]+)!([^\x00\r\n\ ]+?)@?([a-z0-9\.\-:\/_]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;

var parse = function (data) {
    var i,
        msg,
        msg2,
        trm,
        j,
        tags = [],
        tag;

    //DECODE server encoding 
    data = iconv.decode(data, this.encoding);

    if (this.hold_last && this.held_data !== '') {
        data = this.held_data + data;
        this.hold_last = false;
        this.held_data = '';
    }

    // If the last line is incomplete, hold it until we have more data
    if (data.substr(-1) !== '\n') {
        this.hold_last = true;
    }

    // Process our data line by line
    data = data.split("\n");
    for (i = 0; i < data.length; i++) {
        if (!data[i]) break;

        // If flagged to hold the last line, store it and move on
        if (this.hold_last && (i === data.length - 1)) {
            this.held_data = data[i];
            break;
        }
        
        // Parse the complete line, removing any carriage returns
        msg = parse_regex.exec(data[i].replace(/^\r+|\r+$/, ''));

        if (msg) {
            if (msg[1]) {
                tags = msg[1].split(';');
                for (j = 0; j < tags.length; j++) {
                    tag = tags[j].split('=');
                    tags[j] = {tag: tag[0], value: tag[1]};
                }
            }
            msg = {
                tags:       tags,
                prefix:     msg[2],
                nick:       msg[3],
                ident:      msg[4],
                hostname:   msg[5] || '',
                command:    msg[6],
                params:     msg[7] || '',
                trailing:   (msg[8]) ? msg[8].trim() : ''
            };
            msg.params = msg.params.split(' ');
            this.irc_commands.dispatch(msg.command.toUpperCase(), msg);
        } else {
            // The line was not parsed correctly, must be malformed
            console.log("Malformed IRC line: " + data[i].replace(/^\r+|\r+$/, ''));
        }
    }
};

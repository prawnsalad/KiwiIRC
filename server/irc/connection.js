var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    _               = require('lodash'),
    EventEmitter2   = require('eventemitter2').EventEmitter2,
    IrcServer       = require('./server.js'),
    IrcChannel      = require('./channel.js'),
    IrcUser         = require('./user.js');


var IrcConnection = function (hostname, port, ssl, nick, user, pass, state) {
    var that = this;
    EventEmitter2.call(this,{
        wildcard: true,
        delimiter: ':'
    });
    
    // Socket state
    this.connected = false;

    // If registeration with the IRCd has completed
    this.registered = false;

    // If we are in the CAP negotiation stage
    this.cap_negotiation = true;

    // User information
    this.nick = nick;
    this.user = user;  // Contains users real hostname and address
    this.username = this.nick.replace(/[^0-9a-zA-Z\-_.]/, '');
    this.password = pass;
    
    // State object
    this.state = state;
    
    // IrcServer object
    this.server = new IrcServer(this, hostname, port);
    
    // IrcUser objects
    this.irc_users = Object.create(null);
    
    // IrcChannel objects
    this.irc_channels = Object.create(null);
    
    // Create IrcUser and IrcChannel objects when needed
    // TODO: Remove IrcUser objects when they are no longer needed
    this.on('server:*:connect', function (event) {
        that.nick = event.nick;
        that.irc_users[event.nick] = new IrcUser(that, event.nick);
    });
    this.on('channel:*:join', function (event) {
        var chan;
        if (event.nick === that.nick) {
            chan = new IrcChannel(that, event.channel);
            that.irc_channels[event.channel] = chan;
            chan.irc_events.join.call(chan, event);
        }
    });
    
    this.on('user:*:privmsg', function (event) {
        var user;
        if (event.channel === that.nick) {
            if (!that.irc_users[event.nick]) {
                user = new IrcUser(that, event.nick);
                that.irc_users[event.nick] = user;
                user.irc_events.privmsg.call(user, event);
            }
        }
    });

    // IRC connection information
    this.irc_host = {hostname: hostname, port: port};
    this.ssl = !(!ssl);

    // Options sent by the IRCd
    this.options = Object.create(null);
    this.cap = {requested: [], enabled: []};

    // Is SASL supported on the IRCd
    this.sasl = false;
    
    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = '';


    // Call any modules before making the connection
    global.modules.emit('irc:connecting', {connection: this})
        .done(function () {
            that.connect();
        });
};
util.inherits(IrcConnection, EventEmitter2);

module.exports.IrcConnection = IrcConnection;




/**
 * Start the connection to the IRCd
 */
IrcConnection.prototype.connect = function () {
    var that = this;

    // The socket connect event to listener for
    var socket_connect_event_name = 'connect';


    // Make sure we don't already have an open connection
    this.disposeSocket();

    // Open either a secure or plain text socket
    if (this.ssl) {
        this.socket = tls.connect({
            host: this.irc_host.hostname,
            port: this.irc_host.port,
            rejectUnauthorized: global.config.reject_unauthorised_certificates
        });

        socket_connect_event_name = 'secureConnect';

    } else {
        this.socket = net.connect({
            host: this.irc_host.hostname,
            port: this.irc_host.port
        });
    }

    this.socket.setEncoding('utf-8');

    this.socket.on(socket_connect_event_name, function () {
        that.connected = true;
        socketConnectHandler.apply(that, arguments);
    });

    this.socket.on('error', function (event) {
        that.emit('error', event);

    });
    
    this.socket.on('data', function () {
        parse.apply(that, arguments);
    });
    
    this.socket.on('close', function (had_error) {
        that.connected = false;
        that.emit('close');

        // Close the whole socket down
        that.disposeSocket();
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
    this.socket.write(data + '\r\n', 'utf-8', callback);
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
    _.each(this.irc_users, function (user) {
        user.dispose();
    });
    _.each(this.irc_channels, function (chan) {
        chan.dispose();
    });
    this.irc_users = null;
    this.irc_channels = null;
    this.disposeSocket();
    this.removeAllListeners();
};



/**
 * Clean up any sockets for this IrcConnection
 */
IrcConnection.prototype.disposeSocket = function () {
    if (this.socket) {
        this.socket.removeAllListeners();
        this.socket = null;
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

    global.modules.emit('irc:authorize', connect_data).done(function () {
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
            return parseInt(i, 10).toString(16);
        }).join('');

    }

    return connect_data;
}



/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:(@[^ ]+) )?):(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/_]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;

var parse = function (data) {
    var i,
        msg,
        msg2,
        trm,
        j,
        tags = [],
        tag;
    
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

            this.emit('irc_' + msg.command.toUpperCase(), msg);

        } else {

            // The line was not parsed correctly, must be malformed
            console.log("Malformed IRC line: " + data[i].replace(/^\r+|\r+$/, ''));
        }
    }
};

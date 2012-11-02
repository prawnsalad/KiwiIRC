var net     = require('net'),
    tls     = require('tls'),
    events  = require('events'),
    util    = require('util'),
    _       = require('underscore');

var IrcConnection = function (hostname, port, ssl, nick, user, pass) {
    var that = this;
    events.EventEmitter.call(this);
    
    if (ssl) {
        this.socket = tls.connect({
            host: hostname,
            port: port,
            rejectUnauthorized: global.config.reject_unauthorised_certificates
        }, function () {
            connect_handler.apply(that, arguments);
        });
    } else {
        this.socket = net.createConnection(port, hostname);
        this.socket.on('connect', function () {
            connect_handler.apply(that, arguments);
        });
    }
    
    this.socket.on('error', function (event) {
        that.emit('error', event);
    });
    
    this.socket.setEncoding('utf-8');
    
    this.socket.on('data', function () {
        parse.apply(that, arguments);
    });
    
    this.socket.on('close', function () {
        that.emit('close');
    });
    
    this.connected = false;
    this.registered = false;
    this.nick = nick;
    this.user = user;
    this.irc_host = {hostname: hostname, port: port};
    this.ssl = !(!ssl);
    this.options = Object.create(null);
    
    this.password = pass;
    this.hold_last = false;
    this.held_data = '';
};
util.inherits(IrcConnection, events.EventEmitter);

module.exports.IrcConnection = IrcConnection;


IrcConnection.prototype.write = function (data, callback) {
    write.call(this, data + '\r\n', 'utf-8', callback);
};

IrcConnection.prototype.end = function (data, callback) {
    end.call(this, data + '\r\n', 'utf-8', callback);
};

IrcConnection.prototype.dispose = function () {
    this.removeAllListeners();
};


var write = function (data, encoding, callback) {
    this.socket.write(data, encoding, callback);
};

var end = function (data, encoding, callback) {
    this.socket.end(data, encoding, callback);
};


var connect_handler = function () {
    var that = this,
        connect_data;

    // Build up data to be used for webirc/etc detection
    connect_data = {
        user: this.user,
        nick: this.nick,
        realname: '[www.kiwiirc.com] ' + this.nick,
        username: this.nick.replace(/[^0-9a-zA-Z\-_.]/, ''),
        irc_host: this.irc_host
    };

    // Let the webirc/etc detection modify any required parameters
    connect_data = findWebIrc(connect_data);

    // Send any initial data for webirc/etc
    if (connect_data.prepend_data) {
        _.each(connect_data.prepend_data, function(data) {
            that.write(data);
        });
    }

    if (this.password) {
        this.write('PASS ' + this.password);
    }
    
    this.write('NICK ' + connect_data.nick);
    this.write('USER ' + connect_data.username + ' 0 0 :' + connect_data.realname);
    
    this.connected = true;
    this.emit('connected');
};




function findWebIrc(connect_data) {
    var webirc_pass = global.config.webirc_pass;
    var ip_as_username = global.config.ip_as_username;
    var tmp;

    // Do we have a WEBIRC password for this?
    if (webirc_pass && webirc_pass[connect_data.irc_host.hostname]) {
        tmp = 'WEBIRC ' + webirc_pass[connect_data.irc_host.hostname] + ' KiwiIRC ';
        tmp += connect_data.user.hostname + ' ' + connect_data.user.address;
        connect_data.prepend_data = [tmp];
    }


    // Check if we need to pass the users IP as its username/ident
    if (ip_as_username && ip_as_username.indexOf(connect_data.irc_host.hostname) > -1) {
        // Get a hex value of the clients IP
        connect_data.username = connect_data.user.address.split('.').map(function(i, idx){
            return parseInt(i, 10).toString(16);
        }).join('');

    }

    return connect_data;
}



parse_regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;
var parse = function (data) {
    var i,
        msg,
		msg2,
		trm;
    
    if ((this.hold_last) && (this.held_data !== '')) {
        data = this.held_data + data;
        this.hold_last = false;
        this.held_data = '';
    }
    if (data.substr(-1) !== '\n') {
        this.hold_last = true;
    }
    data = data.split("\n");
    for (i = 0; i < data.length; i++) {
        if (data[i]) {
            if ((this.hold_last) && (i === data.length - 1)) {
                this.held_data = data[i];
                break;
            }

            // We have a complete line of data, parse it!
            msg = parse_regex.exec(data[i].replace(/^\r+|\r+$/, ''));
            if (msg) {
                msg = {
                    prefix:     msg[1],
                    nick:       msg[2],
                    ident:      msg[3],
                    hostname:   msg[4] || '',
                    command:    msg[5],
                    params:     msg[6] || '',
                    trailing:   (msg[7]) ? msg[7].trim() : ''
                };
                msg.params = msg.params.split(' ');

                this.emit('irc_' + msg.command.toUpperCase(), msg);
            } else {
                console.log("Malformed IRC line: " + data[i].replace(/^\r+|\r+$/, ''));
            }
        }
    }
};

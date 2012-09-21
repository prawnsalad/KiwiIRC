var net     = require('net'),
    tls     = require('tls'),
    events  = require('events'),
    util    = require('util');

var IRCConnection = function (hostname, port, ssl, nick, user, pass, webirc) {
    var that = this;
    events.EventEmitter.call(this);
    
    if (ssl) {
        this.socket = tls.connect(port, hostname, {}, connect_handler);
    } else {
        this.socket = net.createConnection(port, hostname);
        this.socket.on('connect', function () {
            connect_handler.apply(that, arguments);
        });
    }
    
    this.socket.on('error', function () {
        var a = Array.prototype.slice.call(arguments);
        a.unshift('error');
        that.emit.apply(this, a);
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
    this.ssl = !(!ssl);
    this.options = Object.create(null);
    
    this.webirc = webirc;
    this.password = pass;
    this.hold_last = false;
    this.held_data = '';
};
util.inherits(IRCConnection, events.EventEmitter);

IRCConnection.prototype.write = function (data, callback) {
    console.log('S<--', data);
    write.call(this, data + '\r\n', 'utf-8', callback);
};

IRCConnection.prototype.end = function (data, callback) {
    console.log('S<--', data);
    console.log('Closing docket');
    end.call(this, data + '\r\n', 'utf-8', callback);
};

var write = function (data, encoding, callback) {
    this.socket.write(data, encoding, callback);
};

var end = function (data, encoding, callback) {
    this.socket.end(data, encoding, callback);
};

module.exports.IRCConnection = IRCConnection;

var connect_handler = function () {
    if (this.webirc) {
        this.write('WEBIRC ' + webirc.pass + ' KiwiIRC ' + this.user.hostname + ' ' + this.user.address);
    }
    if (this.password) {
        this.write('PASS ' + password);
    }
    //this.write('CAP LS');
    this.write('NICK ' + this.nick);
    this.write('USER kiwi_' + this.nick.replace(/[^0-9a-zA-Z\-_.]/, '') + ' 0 0 :' + this.nick);
    
    this.connected = true;
    console.log("IRCConnection.emit('connected')");
    this.emit('connected');
};

//parse_regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;
alt_regex   = /(?::(([0-9a-z][\x2d0-9a-z]*[0-9a-z]*(?:\x2e[0-9a-z][\x2d0-9a-z]*[0-9a-z]*)*|[\x5b-\x7d][\x2d0-9\x5b-\x7d]{0,8})(?:(?:!([\x01-\t\v\f\x0e-\x1f!-\x3f\x5b-\xff]+))?@([0-9a-z][\x2d0-9a-z]*[0-9a-z]*(?:\x2e[0-9a-z][\x2d0-9a-z]*[0-9a-z]*)*|\d{1,3}\x2e\d{1,3}\x2e\d{1,3}\x2e\d{1,3}|[0-9a-f]+(?::[0-9a-f]+){7}|0:0:0:0:0:(?:0|ffff):\d{1,3}\x2e\d{1,3}\x2e\d{1,3}\x2e\d{1,3}))?)\x20)?([a-z]+|\d{3})((?:\x20[\x01-\t\v\f\x0e-\x1f!-9;-@\x5b-\xff][\x01-\t\v\f\x0e-\x1f!-@\x5b-\xff]*){0,14}(?:\x20:[\x01-\t\v\f\x0e-@\x5b-\xff]*)?|(?:\x20[\x01-\t\v\f\x0e-\x1f!-9;-@\x5b-\xff][\x01-\t\v\f\x0e-\x1f!-@\x5b-\xff]*){14}(?:\x20:?[\x01-\t\v\f\x0e-@\x5b-\xff]*)?)?/i;

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
            //msg = parse_regex.exec(data[i].replace(/^\r+|\r+$/, ''));
			msg2 = alt_regex.exec(data[i].replace(/^\r+|\r+$/, ''));
			//console.log(msg2);
            if (msg2) {
                msg = {
                    prefix:     msg2[1],
                    nick:       msg2[2],
                    ident:      msg2[3],
                    hostname:   msg2[4],
                    command:    msg2[5]
                };
				trm = msg2[6].indexOf(':');
				if (trm !== -1){
					msg.params = msg2[6].substr(0, trm - 1).trim().split(" ");
					msg.trailing = msg2[6].substr(trm + 1).trim();
				} else {
					msg.params = msg2[6].trim().split(" ");
				}
                console.log('S-->', data[i]);
				//console.log(msg);
                this.emit('irc_' + msg.command.toUpperCase(), msg);
            } else {
                console.log("Malformed IRC line: " + data[i].replace(/^\r+|\r+$/, ''));
            }
        }
    }
};

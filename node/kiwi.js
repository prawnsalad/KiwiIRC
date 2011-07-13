var tls = require('tls'),
    net = require('net'),
    http = require('http'),
    ws = require('socket.io'),
    _ = require('./underscore.min.js');

var ircNumerics = {
    RPL_WHOISUSER:      311,
	RPL_WHOISSERVER:    312,
	RPL_WHOISOPERATOR:  313,
	RPL_WHOISIDLE:      317,
	RPL_ENDOFWHOIS:     318,
	RPL_WHOISCHANNELS:  319,
    RPL_NAMEREPLY:      353,
    RPL_ENDOFNAMES:     366,
    RPL_MOTD:           372,
	RPL_WHOISMODES:     379
};


var parseIRCMessage = function (websocket, ircSocket, data) {
    var msg, regex, opts, options, opt, i, j, matches, nick, users, chan, params, prefix, prefixes, nicklist;
    regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@([a-z0-9\.\-:]+)) )?([a-z0-9]+)(?:(?: ([^:]+))?(?: :(.+))?)$/i;
    msg = regex.exec(data);
    if (msg) {
        msg = {
            prefix:     msg[1],
            nick:       msg[2],
            ident:      msg[3],
            hostname:   msg[4],
            command:    msg[5],
            params:     msg[6] || '',
            trailing:   (msg[7]) ? msg[7].trim() : ''
        };
        switch (msg.command.toUpperCase()) {
        case 'PING':
            ircSocket.write('PONG ' + msg.trailing + '\r\n');
            break;
        case '001':
            websocket.emit('message', {event: 'connect', connected: true, host: null});
            break;
        case '005':
            opts = msg.params.split(" ");
            options = [];
            for (i = 0; i < opts.length; i++) {
                opt = opts[i].split("=", 2);
                opt[0] = opt[0].toUpperCase();
                ircSocket.ircServer.options[opt[0]] = opt[1] || true;
                if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES'], opt[0])) {
                    if (opt[0] === 'PREFIX') {
                        regex = /\(([^)]*)\)(.*)/;
                        matches = regex.exec(opt[1]);
                        if ((matches) && (matches.length === 3)) {
                            options[opt[0]] = {};
                            for (j = 0; j < matches[2].length; j++) {
                                options[opt[0]][matches[2].charAt(j)] = matches[1].charAt(j);
                            }
                        }
                    }
                }
            }
            websocket.emit('message', {event: 'options', server: '', "options": options});
            break;
        case ircNumerics.RPL_WHOISUSER:
        case ircNumerics.RPL_WHOISSERVER:
        case ircNumerics.RPL_WHOISOPERATOR:
        case ircNumerics.RPL_WHOISIDLE:
        case ircNumerics.RPL_ENDOFWHOIS:
        case ircNumerics.RPL_WHOISCHANNELS:
        case ircNumerics.RPL_WHOISMODES:
            websocket.emit('message', {event: 'whois', server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing});
            break;
        case ircNumerics.RPL_MOTD:
            websocket.emit('message', {event: 'motd', server: '', "msg": msg.trailing});
            break;
        case ircNumerics.RPL_NAMEREPLY:
            params = msg.params.split(" ");
            nick = params[0];
            chan = params[2];
            users = msg.trailing.split(" ");
            prefixes = _.values(ircSocket.ircServer.options.PREFIX);
            _.each(users, function (user) {
                if (_.include(prefix, user.charAt(0))) {
                    prefix = user.charAt(0);
                    user = user.substring(1);
                    nicklist[user] = prefix;
                }
                if (i >= 50) {
                    websocket.emit('message', {event: 'userlist', server: '', "users": nicklist, channel: chan});
                    nicklist = {};
                    i = 0;
                }
                i++;
            });
            if (nicklist.length > 0) {
                websocket.emit('message', {event: 'userlist', server: '', "users": nicklist, channel: chan});
            }
            break;
        case RPL_ENDOFNAMES:
            chan = msg.params.split(" ")[1];
            websocket.emit('message', {event: 'userlist_end', server: '', channel: chan});
            break;
        }
    } else {
        console.log("Unknown command.\r\n");
    }
};

//setup websocket listener
var io = ws.listen(7777);
io.sockets.on('connection', function (websocket) {
    websocket.on('irc connect', function (nick, host, port, ssl, callback) {
        var ircSocket, i;
        //setup IRC connection
        if (!ssl) {
            ircSocket = net.createConnection(port, host);
        } else {
            ircSocket = tls.connect(port, host);
        }
        ircSocket.setEncoding('ascii');
        ircSocket.ircServer = {options: {}};
        
        ircSocket.on('data', function (data) {
            data = data.split("\r\n");            
            for (i = 0; i < data.length; i++) {
                if (data[i]) {
                    console.log(data[i] + '\r\n');
                    parseIRCMessage(websocket, ircSocket, data[i]);
                }
            }
        });
        
        // Send the login data
        ircSocket.write('NICK ' + nick + '\r\n');
        ircSocket.write('USER ' + nick + '_kiwi 0 0 :' + nick + '\r\n');
        
        if ((callback) && (typeof (callback) === 'function')) {
            callback();
        }
    });
    websocket.on('message', function (msg, callback) {
        console.log(msg);
        if ((callback) && (typeof (callback) === 'function')) {
            callback();
        }
    });
});




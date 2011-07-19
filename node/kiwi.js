/*jslint regexp: true, confusion: true, undef: false, node: true, sloppy: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */

var tls = require('tls'),
    net = require('net'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    url = require('url'),
    static_server = require('node-static'),
    ws = require('socket.io'),
    jade = require('jade'),
    _ = require('./lib/underscore.min.js'),
    starttls = require('./lib/starttls.js');

var config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'ascii'));

var ircNumerics = {
    RPL_WELCOME:        '001',
    RPL_ISUPPORT:       '005',
    RPL_WHOISUSER:      '311',
    RPL_WHOISSERVER:    '312',
    RPL_WHOISOPERATOR:  '313',
    RPL_WHOISIDLE:      '317',
    RPL_ENDOFWHOIS:     '318',
    RPL_WHOISCHANNELS:  '319',
    RPL_TOPIC:          '332',
    RPL_NAMEREPLY:      '353',
    RPL_ENDOFNAMES:     '366',
    RPL_MOTD:           '372',
    RPL_WHOISMODES:     '379',
    ERR_NOSUCHNICK:     '401',
    ERR_LINKCHANNEL:    '470',
    RPL_STARTTLS:       '670'
};


var parseIRCMessage = function (websocket, ircSocket, data) {
    /*global ircSocketDataHandler */
    var msg, regex, opts, options, opt, i, j, matches, nick, users, chan, params, prefix, prefixes, nicklist, caps;
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
        case ircNumerics.RPL_WELCOME:
            if (ircSocket.IRC.CAP.negotiating) {
                ircSocket.IRC.CAP.negotiating = false;
                ircSocket.IRC.CAP.enabled = [];
                ircSocket.IRC.CAP.requested = [];
            }
            websocket.emit('message', {event: 'connect', connected: true, host: null});
            break;
        case ircNumerics.RPL_ISUPPORT:
            opts = msg.params.split(" ");
            options = [];
            for (i = 0; i < opts.length; i++) {
                opt = opts[i].split("=", 2);
                opt[0] = opt[0].toUpperCase();
                ircSocket.IRC.options[opt[0]] = opt[1] || true;
                if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES'], opt[0])) {
                    if (opt[0] === 'PREFIX') {
                        regex = /\(([^)]*)\)(.*)/;
                        matches = regex.exec(opt[1]);
                        if ((matches) && (matches.length === 3)) {
                            ircSocket.IRC.options[opt[0]] = {};
                            for (j = 0; j < matches[2].length; j++) {
                                ircSocket.IRC.options[opt[0]][matches[2].charAt(j)] = matches[1].charAt(j);
                            }
                        }
                    }
                }
            }
            websocket.emit('message', {event: 'options', server: '', "options": ircSocket.IRC.options});
            break;
        case ircNumerics.RPL_WHOISUSER:
        case ircNumerics.RPL_WHOISSERVER:
        case ircNumerics.RPL_WHOISOPERATOR:
        case ircNumerics.RPL_ENDOFWHOIS:
        case ircNumerics.RPL_WHOISCHANNELS:
        case ircNumerics.RPL_WHOISMODES:
            websocket.emit('message', {event: 'whois', server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing});
            break;
        case ircNumerics.RPL_WHOISIDLE:
            params = msg.params.split(" ", 3);
            websocket.emit('message', {event: 'whois', server: '', nick: params[1], "msg": params[2] + ' ' + msg.trailing});
        case ircNumerics.RPL_MOTD:
            websocket.emit('message', {event: 'motd', server: '', "msg": msg.trailing});
            break;
        case ircNumerics.RPL_NAMEREPLY:
            params = msg.params.split(" ");
            nick = params[0];
            chan = params[2];
            users = msg.trailing.split(" ");
            prefixes = _.values(ircSocket.IRC.options.PREFIX);
            nicklist = {};
            i = 0;
            _.each(users, function (user) {
                if (_.include(prefix, user.charAt(0))) {
                    prefix = user.charAt(0);
                    user = user.substring(1);
                    nicklist[user] = prefix;
                } else {
                    nicklist[user] = '';
                }
                if (i++ >= 50) {
                    websocket.emit('message', {event: 'userlist', server: '', "users": nicklist, channel: chan});
                    nicklist = {};
                    i = 0;
                }
            });
            if (i > 0) {
                websocket.emit('message', {event: 'userlist', server: '', "users": nicklist, channel: chan});
            } else {
                console.log("oops");
            }
            break;
        case ircNumerics.RPL_ENDOFNAMES:
            websocket.emit('message', {event: 'userlist_end', server: '', channel: msg.params.split(" ")[1]});
            break;
        case ircNumerics.ERR_LINKCHANNEL:
            params = msg.params.split(" "); 
            websocket.emit('message', {event: 'channel_redirect', from: params[1], to: params[2]});
            break;
        case ircNumerics.ERR_NOSUCHNICK:
			//TODO: shit
			break;
        case 'JOIN':
            websocket.emit('message', {event: 'join', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.trailing});
            if (msg.nick === ircSocket.IRC.nick) {
                ircSocket.write('NAMES ' + msg.trailing + '\r\n');
            }
            break;
        case 'PART':
            websocket.emit('message', {event: 'part', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), message: msg.trailing});
            break;
        case 'KICK':
            params = msg.params.split(" ");
            websocket.emit('message', {event: 'kick', kicked: params[1], nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: params[0].trim(), message: msg.trailing});
            break;
        case 'QUIT':
            websocket.emit('message', {event: 'quit', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, message: msg.trailing});
            break;
        case 'NOTICE':
            websocket.emit('message', {event: 'notice', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing});
            break;
        case 'NICK':
            websocket.emit('message', {event: 'nick', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, newnick: msg.trailing});
            break;
        case 'TOPIC':
            websocket.emit('message', {event: 'topic', nick: msg.nick, channel: msg.params, topic: msg.trailing});
            break;
        case ircNumerics.RPL_TOPIC:
            websocket.emit('message', {event: 'topic', nick: '', channel: msg.params.split(" ")[1], topic: msg.trailing});
            break;
        case 'MODE':
            opts = msg.params.split(" ");
            params = {event: 'mode', nick: msg.nick};
            switch (opts.length) {
            case 1:
                params.effected_nick = opts[0];
                params.mode = msg.trailing;
                break;
            case 2:
                params.channel = opts[0];
                params.mode = opts[1];
                break;
            default:
                params.channel = opts[0];
                params.mode = opts[1];
                params.effected_nick = opts[2];
                break;
            }
            websocket.emit('message', params);
            break;
        case 'PRIVMSG':
            websocket.emit('message', {event: 'msg', nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing});
            break;
        case 'CAP':
            caps = config.cap_options;
            options = msg.trailing.split(" ");
            switch (_.first(msg.params.split(" "))) {
            case 'LS':
                opts = '';
                _.each(_.intersect(caps, options), function (cap) {
                    if (opts !== '') {
                        opts += " ";
                    }
                    opts += cap;
                    ircSocket.IRC.CAP.requested.push(cap);
                });
                if (opts.length > 0) {
                    ircSocket.write('CAP REQ :' + opts + '\r\n');
                } else {
                    ircSocket.write('CAP END\r\n');
                }
                // TLS is special
                /*if (_.include(options, 'tls')) {
                    ircSocket.write('STARTTLS\r\n');
                    ircSocket.IRC.CAP.requested.push('tls');
                }*/
                break;
            case 'ACK':
                _.each(options, function (cap) {
                    ircSocket.IRC.CAP.enabled.push(cap);
                });
                if (_.last(msg.params.split(" ")) !== '*') {
                    ircSocket.IRC.CAP.requested = [];
                    ircSocket.IRC.CAP.negotiating = false;
                    ircSocket.write('CAP END\r\n');
                }
                break;
            case 'NAK':
                ircSocket.IRC.CAP.requested = [];
                ircSocket.IRC.CAP.negotiating = false;
                ircSocket.write('CAP END\r\n');
                break;
            }
            break;
        /*case ircNumerics.RPL_STARTTLS:
            try {
                IRC = ircSocket.IRC;
                listeners = ircSocket.listeners('data');
                ircSocket.removeAllListeners('data');
                ssl_socket = starttls(ircSocket, {}, function () {
                    ssl_socket.on("data", function (data) {
                        ircSocketDataHandler(data, websocket, ssl_socket);
                    });
                    ircSocket = ssl_socket;
                    ircSocket.IRC = IRC;
                    _.each(listeners, function (listener) {
                        ircSocket.addListener('data', listener);
                    });
                });
                //console.log(ircSocket);
            } catch (e) {
                console.log(e);
            }
            break;*/
        }
    } else {
        console.log("Unknown command.\r\n");
    }
};

var ircSocketDataHandler = function (data, websocket, ircSocket) {
    var i;
    if ((ircSocket.holdLast) && (ircSocket.held !== '')) {
        data = ircSocket.held + data;
        ircSocket.holdLast = false;
        ircSocket.held = '';
    }
    if (data.substr(-2) === '\r\n') {
        ircSocket.holdLast = true;
    }
    data = data.split("\r\n");         
    for (i = 0; i < data.length; i++) {
        if (data[i]) {
            if ((ircSocket.holdLast) && (i === data.length - 1)) {
                ircSocket.held = data[i];
                break;
            }
            console.log("->" + data[i]);
            parseIRCMessage(websocket, ircSocket, data[i]);
        }
    }
};

var fileServer = new (static_server.Server)(__dirname + '/client');

var httpHandler = function (request, response) {
    var uri, subs, useragent, agent, server_set, server, nick, debug, touchscreen;
    if (config.handle_http) {
        uri = url.parse(request.url);
        subs = uri.pathname.substr(0, 4);
        if ((subs === '/js/') || (subs === '/css') || (subs === '/img')) {
            request.addListener('end', function () {
                fileServer.serve(request, response);
            });
        } else if (uri.pathname === '/') {
            useragent = (response.headers) ? response.headers['user-agent']: '';
            if (useragent.indexOf('android') !== -1) {
                agent = 'android';
                touchscreen = true;
            } else if (useragent.indexOf('iphone') !== -1) {
                agent = 'iphone';
                touchscreen = true;
            } else if (useragent.indexOf('ipad') !== -1) {
                agent = 'ipad';
                touchscreen = true;
            } else if (useragent.indexOf('ipod') !== -1) {
                agent = 'ipod';
                touchscreen = true;
            } else {
                agent = 'normal';
                touchscreen = false;
            }
            if (uri.query) {
                server_set = (uri.query.server !== '');
                server = uri.query.server || 'irc.anonnet.org';
                nick = uri.query.nick || '';
                debug = (uri.query.debug !== '');
            } else {
                server = 'irc.anonnet.org';
                nick = '';
            }
            response.setHeader('Connection', 'close');
            response.setHeader('X-Generated-By', 'KiwiIRC');
            jade.renderFile(__dirname + '/client/index.html.jade', { locals: { "touchscreen": touchscreen, "debug": debug, "server_set": server_set, "server": server, "nick": nick, "agent": agent, "config": config }}, function (err, html) {
                if (!err) {
                    response.write(html);
                } else {
                    response.statusCode = 500;
                }
                response.end();
            });
        } else if (uri.pathname.substr(0, 10) === '/socket.io') {
            // Do nothing!
        } else {
            response.statusCode = 404;
            response.end();
        }
    }
};

//setup websocket listener
if (config.listen_ssl) {
    var httpServer = https.createServer({key: fs.readFileSync(__dirname + '/' + config.ssl_key), cert: fs.readFileSync(__dirname + '/' + config.ssl_cert)}, httpHandler);
    var io = ws.listen(httpServer, {secure: true});
    httpServer.listen(config.port, config.bind_address);
} else {
    var httpServer = http.createServer(httpHandler);
    var io = ws.listen(httpServer, {secure: false});
    httpServer.listen(config.port, config.bind_address);
}
io.of('/kiwi').on('connection', function (websocket) {
    websocket.on('irc connect', function (nick, host, port, ssl, callback) {
        var ircSocket;
        //setup IRC connection
        if (!ssl) {
            ircSocket = net.createConnection(port, host);
        } else {
            ircSocket = tls.connect(port, host);
        }
        ircSocket.setEncoding('ascii');
        ircSocket.IRC = {options: {}, CAP: {negotiating: true, requested: [], enabled: []}};
        websocket.ircSocket = ircSocket;
        ircSocket.holdLast = false;
        ircSocket.held = '';
        
        ircSocket.on('data', function (data) {
            ircSocketDataHandler(data, websocket, ircSocket);
        });
        
        ircSocket.IRC.nick = nick;
        // Send the login data
        ircSocket.write('CAP LS\r\n');
        ircSocket.write('NICK ' + nick + '\r\n');
        ircSocket.write('USER ' + nick + '_kiwi 0 0 :' + nick + '\r\n');
        
        if ((callback) && (typeof (callback) === 'function')) {
            callback();
        }
    });
    websocket.on('message', function (msg, callback) {
        var args;
        try {
            msg.data = JSON.parse(msg.data);
            args = msg.data.args;
            switch (msg.data.method) {
            case 'msg':
                if ((args.target) && (args.msg)) {
                    websocket.ircSocket.write('PRIVMSG ' + args.target + ' :' + args.msg + '\r\n');
                }
                break;
	        case 'action':
                if ((args.target) && (args.msg)) {
                    websocket.ircSocket.write('PRIVMSG ' + args.target + ' :ACTION ' + args.msg + '\r\n');
                }
                break;
	        case 'raw':
                websocket.ircSocket.write(args.data + '\r\n');
                break;
	        case 'join':
                if (args.channel) {
                    _.each(args.channel.split(","), function (chan) {
                        websocket.ircSocket.write('JOIN ' + chan + '\r\n');
                    });
                }
                break;
	        case 'quit':
                websocket.ircSocket.end('QUIT :' + args.message + '\r\n');
                websocket.sentQUIT = true;
                websocket.ircSocket.destroySoon();
                websocket.disconnect();
                break;
            case 'notice':
                if ((args.target) && (args.msg)) {
                    websocket.ircSocket.write('NOTICE ' + args.target + ' :' + args.msg + '\r\n');
                }
                break;
            default:
            }
            if ((callback) && (typeof (callback) === 'function')) {
                callback();
            }
        } catch (e) {
            console.log("Caught error: " + e);
        }
    });
    websocket.on('disconnect', function () {
        if ((!websocket.sentQUIT) && (websocket.ircSocket)) {
            websocket.ircSocket.end('QUIT :' + config.quit_message + '\r\n');
            websocket.sentQUIT = true;
            websocket.ircSocket.destroySoon();
        }
    });
});


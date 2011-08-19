/*jslint continue: true, forin: true, regexp: true, undef: false, node: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
"use strict";
var tls = require('tls'),
    net = require('net'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    url = require('url'),
    dns = require('dns'),
    crypto = require('crypto'),
    ws = require('socket.io'),
    jsp = require("uglify-js").parser,
    pro = require("uglify-js").uglify,
    _ = require('./lib/underscore.min.js'),
    starttls = require('./lib/starttls.js');

// Libraries may need to know kiwi.js path as __dirname
// only gives that librarys path. Set it here for usage later.
var kiwi_root = __dirname;


/*
 * Find a config file in the following order:
 * - /etc/kiwi/config.json
 * - ./config.json
 */
var config = {},
    config_filename = 'config.json',
    config_dirs = ['/etc/kiwiirc/', __dirname + '/'];

var loadConfig = function () {
    var i, j,
        nconf = {},
        cconf = {},
        found_config = false;
    for (i in config_dirs) {
        try {
            if (fs.lstatSync(config_dirs[i] + config_filename).isDirectory() === false) {
                found_config = true;
                nconf = JSON.parse(fs.readFileSync(config_dirs[i] + config_filename, 'ascii'));
                for (j in nconf) {
                    // If this has changed from the previous config, mark it as changed
                    if (!_.isEqual(config[j], nconf[j])) {
                        cconf[j] = nconf[j];
                    }

                    config[j] = nconf[j];
                }

                console.log('Loaded config file ' + config_dirs[i] + config_filename);
                break;
            }
        } catch (e) {
            switch (e.code) {
            case 'ENOENT':      // No file/dir
                break;
            default:
                console.log('An error occured parsing the config file ' + config_dirs[i] + config_filename + ': ' + e.message);
                return false;
            }
            continue;
        }
    }
    if (Object.keys(config).length === 0) {
        if (!found_config) {
            console.log('Couldn\'t find a config file!');
        }
        return false;
    }
    return [nconf, cconf];
};

if (!loadConfig()) {
    process.exit(0);
}


/*
 * Load the modules as set in the config and print them out
 */
var kiwi_mod = require('./lib/kiwi_mod.js');
kiwi_mod.loadModules(kiwi_root, config);
kiwi_mod.printMods();




/*
 * Some process changes
 */
process.title = 'kiwiirc';
var changeUser = function () {
    if (typeof config.group !== 'undefined' && config.group !== '') {
        try {
            process.setgid(config.group);
        } catch (err) {
            console.log('Failed to set gid: ' + err);
            process.exit();
        }
    }

    if (typeof config.user !== 'undefined' && config.user !== '') {
        try {
            process.setuid(config.user);
        } catch (e) {
            console.log('Failed to set uid: ' + e);
            process.exit();
        }
    }
};




/*
 * And now KiwiIRC, the server :)
 *
 */

var ircNumerics = {
    RPL_WELCOME:            '001',
    RPL_ISUPPORT:           '005',
    RPL_WHOISUSER:          '311',
    RPL_WHOISSERVER:        '312',
    RPL_WHOISOPERATOR:      '313',
    RPL_WHOISIDLE:          '317',
    RPL_ENDOFWHOIS:         '318',
    RPL_WHOISCHANNELS:      '319',
    RPL_NOTOPIC:            '331',
    RPL_TOPIC:              '332',
    RPL_NAMEREPLY:          '353',
    RPL_ENDOFNAMES:         '366',
    RPL_MOTD:               '372',
    RPL_WHOISMODES:         '379',
    ERR_NOSUCHNICK:         '401',
    ERR_CANNOTSENDTOCHAN:   '404',
    ERR_TOOMANYCHANNELS:    '405',
    ERR_NICKNAMEINUSE:      '433',
    ERR_USERNOTINCHANNEL:   '441',
    ERR_NOTONCHANNEL:       '442',
    ERR_NOTREGISTERED:      '451',
    ERR_LINKCHANNEL:        '470',
    ERR_CHANNELISFULL:      '471',
    ERR_INVITEONLYCHAN:     '473',
    ERR_BANNEDFROMCHAN:     '474',
    ERR_BADCHANNELKEY:      '475',
    ERR_CHANOPRIVSNEEDED:   '482',
    RPL_STARTTLS:           '670'
};




var parseIRCMessage = function (websocket, ircSocket, data) {
    /*global ircSocketDataHandler */
    var msg, regex, opts, options, opt, i, j, matches, nick, users, chan, channel, params, prefix, prefixes, nicklist, caps, rtn, obj;
    regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:]+)?) )?([a-z0-9]+)(?:(?: ([^:]+))?(?: :(.+))?)$/i;
    msg = regex.exec(data);
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
        switch (msg.command.toUpperCase()) {
        case 'PING':
            websocket.sendServerLine('PONG ' + msg.trailing);
            break;
        case ircNumerics.RPL_WELCOME:
            if (ircSocket.IRC.CAP.negotiating) {
                ircSocket.IRC.CAP.negotiating = false;
                ircSocket.IRC.CAP.enabled = [];
                ircSocket.IRC.CAP.requested = [];
                ircSocket.IRC.registered = true;
            }
            websocket.sendClientEvent('connect', {connected: true, host: null});
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
                            ircSocket.IRC.options[opt[0]] = [];
                            for (j = 0; j < matches[2].length; j++) {
                                //ircSocket.IRC.options[opt[0]][matches[2].charAt(j)] = matches[1].charAt(j);
                                ircSocket.IRC.options[opt[0]].push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                                //console.log({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                            }
                            //console.log(ircSocket.IRC.options);
                        }
                    }
                }
            }
            websocket.sendClientEvent('options', {server: '', "options": ircSocket.IRC.options});
            break;
        case ircNumerics.RPL_WHOISUSER:
        case ircNumerics.RPL_WHOISSERVER:
        case ircNumerics.RPL_WHOISOPERATOR:
        case ircNumerics.RPL_ENDOFWHOIS:
        case ircNumerics.RPL_WHOISCHANNELS:
        case ircNumerics.RPL_WHOISMODES:
            websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing});
            break;
        case ircNumerics.RPL_WHOISIDLE:
            params = msg.params.split(" ", 4);
            rtn = {server: '', nick: params[1], idle: params[2]};
            if (params[3]) {
                rtn.logon = params[3];
            }
            websocket.sendClientEvent('whois', rtn);
            break;
        case ircNumerics.RPL_MOTD:
            websocket.sendClientEvent('motd', {server: '', "msg": msg.trailing});
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
                    websocket.sendClientEvent('userlist', {server: '', 'users': nicklist, channel: chan});
                    nicklist = {};
                    i = 0;
                }
            });
            if (i > 0) {
                websocket.sendClientEvent('userlist', {server: '', "users": nicklist, channel: chan});
            } else {
                console.log("oops");
            }
            break;
        case ircNumerics.RPL_ENDOFNAMES:
            websocket.sendClientEvent('userlist_end', {server: '', channel: msg.params.split(" ")[1]});
            break;
        case ircNumerics.ERR_LINKCHANNEL:
            params = msg.params.split(" "); 
            websocket.sendClientEvent('channel_redirect', {from: params[1], to: params[2]});
            break;
        case ircNumerics.ERR_NOSUCHNICK:
            websocket.sendClientEvent('irc_error', {error: 'no_such_nick', nick: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case 'JOIN':
            // Some BNC's send malformed JOIN causing the channel to be as a
            // parameter instead of trailing.
            if (typeof msg.trailing === 'string' && msg.trailing !== '') {
                channel = msg.trailing;
            } else if (typeof msg.params === 'string' && msg.params !== '') {
                channel = msg.params;
            }

            websocket.sendClientEvent('join', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: channel});
            if (msg.nick === ircSocket.IRC.nick) {
                websocket.sendServerLine('NAMES ' + msg.trailing);
            }
            break;
        case 'PART':
            websocket.sendClientEvent('part', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), message: msg.trailing});
            break;
        case 'KICK':
            params = msg.params.split(" ");
            websocket.sendClientEvent('kick', {kicked: params[1], nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: params[0].trim(), message: msg.trailing});
            break;
        case 'QUIT':
            websocket.sendClientEvent('quit', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, message: msg.trailing});
            break;
        case 'NOTICE':
            if ((msg.trailing.charAt(0) === String.fromCharCode(1)) && (msg.trailing.charAt(msg.trailing.length - 1) === String.fromCharCode(1))) {
                // It's a CTCP response
                websocket.sendClientEvent('ctcp_response', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(1, msg.trailing.length - 2)});
            } else {
                websocket.sendClientEvent('notice', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing});
            }
            break;
        case 'NICK':
            websocket.sendClientEvent('nick', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, newnick: msg.trailing});
            break;
        case 'TOPIC':
            obj = {nick: msg.nick, channel: msg.params, topic: msg.trailing};
            websocket.sendClientEvent('topic', obj);
            break;
        case ircNumerics.RPL_TOPIC:
            obj = {nick: '', channel: msg.params.split(" ")[1], topic: msg.trailing};
            websocket.sendClientEvent('topic', obj);
            break;
        case ircNumerics.RPL_NOTOPIC:
            obj = {nick: '', channel: msg.params.split(" ")[1], topic: ''};
            websocket.sendClientEvent('topic', obj);
            break;
        case 'MODE':
            opts = msg.params.split(" ");
            params = {nick: msg.nick};
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
            websocket.sendClientEvent('mode', params);
            break;
        case 'PRIVMSG':
            if ((msg.trailing.charAt(0) === String.fromCharCode(1)) && (msg.trailing.charAt(msg.trailing.length - 1) === String.fromCharCode(1))) {
                // It's a CTCP request
                if (msg.trailing.substr(1, 6) === 'ACTION') {
                    websocket.sendClientEvent('action', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(7, msg.trailing.length - 2)});
                } else if (msg.trailing.substr(1, 7) === 'VERSION') {
                    ircSocket.write('NOTICE ' + msg.nick + ' :' + String.fromCharCode(1) + 'VERSION KiwiIRC' + String.fromCharCode(1) + '\r\n');
                } else {
                    websocket.sendClientEvent('ctcp_request', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(1, msg.trailing.length - 2)});
                }
            } else {
                obj = {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing};
                websocket.sendClientEvent('msg', obj);
            }
            break;
        case 'CAP':
            caps = config.cap_options;
            options = msg.trailing.split(" ");
            switch (_.last(msg.params.split(" "))) {
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
                    websocket.sendServerLine('CAP REQ :' + opts);
                } else {
                    websocket.sendServerLine('CAP END');
                }
                // TLS is special
                /*if (_.include(options, 'tls')) {
                    websocket.sendServerLine('STARTTLS');
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
                    websocket.sendServerLine('CAP END');
                }
                break;
            case 'NAK':
                ircSocket.IRC.CAP.requested = [];
                ircSocket.IRC.CAP.negotiating = false;
                websocket.sendServerLine('CAP END');
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
        case ircNumerics.ERR_CANNOTSENDTOCHAN:
            websocket.sendClientEvent('irc_error', {error: 'cannot_send_to_chan', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_TOOMANYCHANNELS:
            websocket.sendClientEvent('irc_error', {error: 'too_many_channels', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_USERNOTINCHANNEL:
            params = msg.params.split(" ");
            websocket.sendClientEvent('irc_error', {error: 'user_not_in_channel', nick: params[0], channel: params[1], reason: msg.trainling});
            break;
        case ircNumerics.ERR_NOTONCHANNEL:
            websocket.sendClientEvent('irc_error', {error: 'not_on_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_CHANNELISFULL:
            websocket.sendClientEvent('irc_error', {error: 'channel_is_full', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_INVITEONLYCHAN:
            websocket.sendClientEvent('irc_error', {error: 'invite_only_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_BANNEDFROMCHAN:
            websocket.sendClientEvent('irc_error', {error: 'banned_from_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_BADCHANNELKEY:
            websocket.sendClientEvent('irc_error', {error: 'bad_channel_key', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_CHANOPRIVSNEEDED:
            websocket.sendClientEvent('irc_error', {error: 'chanop_privs_needed', channel: msg.params.split(" ")[1], reason: msg.trailing});
            break;
        case ircNumerics.ERR_NICKNAMEINUSE:
            websocket.sendClientEvent('irc_error', {error: 'nickname_in_use', nick: _.last(msg.params.split(" ")), reason: msg.trailing});
            break;
        case 'ERROR':
            ircSocket.end();
            websocket.sendClientEvent('irc_error', {error: 'error', reason: msg.trailing});
            websocket.disconnect();
            break;
        case ircNumerics.ERR_NOTREGISTERED:
            if (ircSocket.IRC.registered) {
                // We may be doing something wrong...
            }
            break;
        default:
            console.log("Unknown command (" + String(msg.command).toUpperCase() + ")");
        }
    } else {
        console.log("Malformed IRC line");
    }
};


/*
 * NOTE: Some IRC servers or BNC's out there incorrectly use
 * only \n as a line splitter.
 */
var ircSocketDataHandler = function (data, websocket, ircSocket) {
    var i;
    if ((ircSocket.holdLast) && (ircSocket.held !== '')) {
        data = ircSocket.held + data;
        ircSocket.holdLast = false;
        ircSocket.held = '';
    }
    if (data.substr(-1) !== '\n') {
        ircSocket.holdLast = true;
    }
    data = data.split("\n");         
    for (i = 0; i < data.length; i++) {
        if (data[i]) {
            if ((ircSocket.holdLast) && (i === data.length - 1)) {
                ircSocket.held = data[i];
                break;
            }

            // We have a complete line of data, parse it!
            parseIRCMessage(websocket, ircSocket, data[i].replace(/^\r+|\r+$/, ''));
        }
    }
};

if (config.handle_http) {
    var fileServer = new (require('node-static').Server)(__dirname + config.public_http);
    var jade = require('jade');
    var cache = {alljs: '', html: []};
}

var httpHandler = function (request, response) {
    var uri, subs, useragent, agent, server_set, server, nick, debug, touchscreen, hash,
        min = {};
    if (config.handle_http) {
        uri = url.parse(request.url, true);
        subs = uri.pathname.substr(0, 4);
        if (uri.pathname === '/js/all.js') {
            if (cache.alljs === '') {
                min.util = fs.readFileSync(config.public_http + 'js/util.js');
                min.gateway = fs.readFileSync(config.public_http + 'js/gateway.js');
                min.front = fs.readFileSync(config.public_http + 'js/front.js');
                min.iscroll = fs.readFileSync(config.public_http + 'js/iscroll.js');
                min.ast = jsp.parse(min.util + min.gateway + min.front + min.iscroll);
                min.ast = pro.ast_mangle(min.ast);
                min.ast = pro.ast_squeeze(min.ast);
                min.final_code = pro.gen_code(min.ast);
                cache.alljs = min.final_code;
                hash = crypto.createHash('md5').update(cache.alljs);
                cache.alljs_hash = hash.digest('base64');
            }
            if (request.headers['if-none-match'] === cache.alljs_hash) {
                response.statusCode = 304;
            } else {
                response.setHeader('ETag', cache.alljs_hash);
                response.write(cache.alljs);
            }
            response.end();
        } else if ((subs === '/js/') || (subs === '/css') || (subs === '/img')) {
            request.addListener('end', function () {
                fileServer.serve(request, response);
            });
        } else if (uri.pathname === '/') {
            useragent = (response.headers) ? response.headers['user-agent'] : '';
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
            response.setHeader('X-Generated-By', 'KiwiIRC');
            hash = crypto.createHash('md5').update(touchscreen ? 't' : 'f').update(debug ? 't' : 'f').update(server_set ? 't' : 'f').update(server).update(nick).update(agent).update(JSON.stringify(config)).digest('base64');
            if (cache.html[hash]) {
                if (request.headers['if-none-match'] === cache.html[hash].hash) {
                    response.statusCode = 304;
                } else {
                    response.setHeader('Etag', cache.html[hash].hash);
                    response.write(cache.html[hash].html);
                }
                response.end();
            } else {
                jade.renderFile(__dirname + '/client/index.html.jade', { locals: { "touchscreen": touchscreen, "debug": debug, "server_set": server_set, "server": server, "nick": nick, "agent": agent, "config": config }}, function (err, html) {
                    if (!err) {
                        var hash2 = crypto.createHash('md5').update(html).digest('base64');
                        cache.html[hash] = {"html": html, "hash": hash2};
                        if (request.headers['if-none-match'] === hash2) {
                            response.statusCode = 304;
                        } else {
                            response.setHeader('Etag', hash2);
                            response.write(html);
                        }
                    } else {
                        response.statusCode = 500;
                    }
                    response.end();
                });
            }
        } else if (uri.pathname.substr(0, 10) === '/socket.io') {
            return;
        } else {
            response.statusCode = 404;
            response.end();
        }
    }
};

var connections = {};

var httpServer, io;
var websocketListen = function (port, host, handler, secure, key, cert) {
    if (httpServer) {
        httpServer.close();
    }
    if (secure) {
        httpServer = https.createServer({key: fs.readFileSync(__dirname + '/' + key), cert: fs.readFileSync(__dirname + '/' + cert)}, handler);
        io = ws.listen(httpServer, {secure: true});
        httpServer.listen(port, host);
    } else {
        httpServer = http.createServer(handler);
        io = ws.listen(httpServer, {secure: false});
        httpServer.listen(port, host);
    }

    io.set('log level', 1);
    io.enable('browser client minification');
    io.enable('browser client etag');
    io.set('transports', config.transports);

    io.of('/kiwi').authorization(function (handshakeData, callback) {
        var address = handshakeData.address.address;
        handshakeData.kiwi = {hostname: null};
        dns.reverse(address, function (err, domains) {
            console.log(domains);
            if (err) {
                handshakeData.kiwi.hostname = err;
            } else {
                handshakeData.kiwi.hostname = _.first(domains);
            }
        });
        if (typeof connections[address] === 'undefined') {
            connections[address] = {count: 0, sockets: []};
        }
        callback(null, true);
    }).on('connection', function (websocket) {
        var con;
        websocket.kiwi = {address: websocket.handshake.address.address, hostname: websocket.handshake.kiwi.hostname};
        con = connections[websocket.kiwi.address];
        if (con.count >= config.max_client_conns) {
            websocket.emit('too_many_connections');
            websocket.disconnect();
        } else {
            con.count += 1;
            con.sockets.push(websocket);

            websocket.sendClientEvent = function (event_name, data) {
                kiwi_mod.run(event_name, data, {websocket: this});
                data.event = event_name;
                websocket.emit('message', data);
            };

            websocket.sendServerLine = function (data, eol) {
                eol = (typeof eol === 'undefined') ? '\r\n' : eol;
                websocket.ircSocket.write(data + eol);
            };

            websocket.on('irc connect', function (nick, host, port, ssl, callback) {
                var ircSocket;
                //setup IRC connection
                if (!ssl) {
                    ircSocket = net.createConnection(port, host);
                } else {
                    ircSocket = tls.connect(port, host);
                }
                ircSocket.setEncoding('ascii');
                ircSocket.IRC = {options: {}, CAP: {negotiating: true, requested: [], enabled: []}, registered: false};
                ircSocket.on('error', function (e) {
                    if (ircSocket.IRC.registered) {
                        websocket.emit('disconnect');
                    } else {
                        websocket.emit('error', e.message);
                    }
                });
                websocket.ircSocket = ircSocket;
                ircSocket.holdLast = false;
                ircSocket.held = '';
                
                ircSocket.on('data', function (data) {
                    ircSocketDataHandler(data, websocket, ircSocket);
                });
                
                ircSocket.IRC.nick = nick;
                // Send the login data
                if ((config.webirc) && (config.webirc_pass[host])) {
                    if ((websocket.kiwi.hostname === null) || (typeof websocket.kiwi.hostname === Error)) {
                        websocket.sendServerLine('WEBIRC ' + config.webirc_pass[host] + ' KiwiIRC ' + websocket.kiwi.address + ' ' + websocket.kiwi.address);
                    } else {
                        websocket.sendServerLine('WEBIRC ' + config.webirc_pass[host] + ' KiwiIRC ' + websocket.kiwi.hostname + ' ' + websocket.kiwi.address);
                    }
                }
                websocket.sendServerLine('CAP LS');
                websocket.sendServerLine('NICK ' + nick);
                websocket.sendServerLine('USER ' + nick.replace(/[^0-9a-zA-Z\-_.]/, '') + '_kiwi 0 0 :' + nick);

                if ((callback) && (typeof (callback) === 'function')) {
                    callback();
                }
            });
            websocket.on('message', function (msg, callback) {
                var args, obj;
                try {
                    msg.data = JSON.parse(msg.data);
                    args = msg.data.args;
                    switch (msg.data.method) {
                    case 'msg':
                        if ((args.target) && (args.msg)) {
                            obj = kiwi_mod.run('msgsend', args, {websocket: websocket});
                            if (obj !== null) {
                                websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + args.msg);
                            }
                        }
                        break;
                    case 'action':
                        if ((args.target) && (args.msg)) {
                            websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + 'ACTION ' + args.msg + String.fromCharCode(1));
                        }
                        break;
                    case 'raw':
                        websocket.sendServerLine(args.data);
                        break;
                    case 'join':
                        if (args.channel) {
                            _.each(args.channel.split(","), function (chan) {
                                websocket.sendServerLine('JOIN ' + chan);
                            });
                        }
                        break;
                    case 'topic':
                        if (args.channel) {
                            websocket.sendServerLine('TOPIC ' + args.channel + ' :' + args.topic);
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
                            websocket.sendServerLine('NOTICE ' + args.target + ' :' + args.msg);
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
                    try {
                        websocket.ircSocket.end('QUIT :' + config.quit_message + '\r\n');
                        websocket.sentQUIT = true;
                        websocket.ircSocket.destroySoon();
                    } catch (e) {
                    }
                }
                con = connections[websocket.kiwi.address];
                con.count -= 1;
                con.sockets = _.reject(con.sockets, function (sock) {
                    return sock === websocket;
                });
            });
        }
    });
};

websocketListen(config.port, config.bind_address, httpHandler, config.listen_ssl, config.ssl_key, config.ssl_cert);

// Now we're listening on the network, set our UID/GIDs if required
changeUser();




var rehash = function () {
    var changes, i,
        reload_config = loadConfig();

    // If loading the new config errored out, dont attempt any changes
    if (reload_config === false) {
        return false;
    }
    
    // We just want the settings that have been changed
    changes = reload_config[1];

    if (Object.keys(changes).length !== 0) {
        console.log('%s config changes: \n', Object.keys(changes).length, changes);
        for (i in changes) {
            switch (i) {
            case 'port':
            case 'bind_address':
            case 'listen_ssl':
            case 'ssl_key':
            case 'ssl_cert':
                websocketListen(config.port, config.bind_address, httpHandler, config.listen_ssl, config.ssl_key, config.ssl_cert);
                delete changes.port;
                delete changes.bind_address;
                delete changes.listen_ssl;
                delete changes.ssl_key;
                delete changes.ssl_cert;
                break;
            case 'user':
            case 'group':
                changeUser();
                delete changes.user;
                delete changes.group;
                break;
            case 'module_dir':
            case 'modules':
                kiwi_mod.loadModules(kiwi_root, config);
                kiwi_mod.printMods();
                delete changes.module_dir;
                delete changes.modules;
                break;
            }
        }
    }

    // Also clear the cached javascript and HTML
    if (config.handle_http) {
        cache = {alljs: '', html: []};
    }

    return true;
};



/*
 * KiwiIRC controlling via STDIN
 */
process.stdin.resume();
process.stdin.on('data', function (chunk) {
    var command;
    command = chunk.toString().trim();
    switch (command) {
    case 'rehash':
        console.log('Rehashing...');
        console.log(rehash() ? 'Rehash complete' : 'Rehash failed');
        break;

    default:
        console.log('Unknown command \'' + command + '\'');
    }
});





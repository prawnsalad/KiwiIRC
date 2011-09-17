/*jslint sloppy: true, continue: true, forin: true, regexp: true, undef: false, node: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
/*globals kiwi_root */
var tls = null;
var net = null;
var http = null;
var https = null;
var fs = null;
var url = null;
var dns = null;
var crypto = null;
var ws = null;
var jsp = null;
var pro = null;
var _ = null;
var starttls = null;
var kiwi = null;

this.init = function (objs) {
	tls = objs.tls;
	net = objs.net;
	http = objs.http;
	https = objs.https;
	fs = objs.fs;
	url = objs.url;
	dns = objs.dns;
	crypto = objs.crypto;
	ws = objs.ws;
	jsp = objs.jsp;
	pro = objs.pro;
	_ = objs._;
	starttls = objs.starttls;
	kiwi = require('./kiwi.js');
};






/*
 * Some process changes
 */
this.setTitle = function () {
	process.title = 'kiwiirc';
};

this.changeUser = function () {
    if (typeof kiwi.config.group !== 'undefined' && kiwi.config.group !== '') {
        try {
            process.setgid(kiwi.config.group);
        } catch (err) {
            console.log('Failed to set gid: ' + err);
            process.exit();
        }
    }

    if (typeof kiwi.config.user !== 'undefined' && kiwi.config.user !== '') {
        try {
            process.setuid(kiwi.config.user);
        } catch (e) {
            console.log('Failed to set uid: ' + e);
            process.exit();
        }
    }
};









var ircNumerics = {
    RPL_WELCOME:            '001',
    RPL_MYINFO:             '004',
    RPL_ISUPPORT:           '005',
    RPL_WHOISUSER:          '311',
    RPL_WHOISSERVER:        '312',
    RPL_WHOISOPERATOR:      '313',
    RPL_WHOISIDLE:          '317',
    RPL_ENDOFWHOIS:         '318',
    RPL_WHOISCHANNELS:      '319',
    RPL_LISTSTART:          '321',
    RPL_LIST:               '322',
    RPL_LISTEND:            '323',
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



this.parseIRCMessage = function (websocket, ircSocket, data) {
    /*global ircSocketDataHandler */
    var msg, regex, opts, options, opt, i, j, matches, nick, users, chan, channel, params, prefix, prefixes, nicklist, caps, rtn, obj, tmp, namespace;
    //regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)?) )?([a-z0-9]+)(?:(?: ([^:]+))?(?: :(.+))?)$/i;
    //regex = /^(?::(\S+) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;
    regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;

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
            //regex = /([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)/i;
            //matches = regex.exec(msg.trailing);
            nick =  msg.params.split(' ')[0];
            websocket.sendClientEvent('connect', {connected: true, host: null, nick: nick});
            break;
        case ircNumerics.RPL_ISUPPORT:
            opts = msg.params.split(" ");
            options = [];
            for (i = 0; i < opts.length; i++) {
                opt = opts[i].split("=", 2);
                opt[0] = opt[0].toUpperCase();
                ircSocket.IRC.options[opt[0]] = (typeof opt[1] !== 'undefined') ? opt[1] : true;
                if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES'], opt[0])) {
                    if (opt[0] === 'PREFIX') {
                        regex = /\(([^)]*)\)(.*)/;
                        matches = regex.exec(opt[1]);
                        if ((matches) && (matches.length === 3)) {
                            ircSocket.IRC.options[opt[0]] = [];
                            for (j = 0; j < matches[2].length; j++) {
                                //ircSocket.IRC.options[opt[0]][matches[2].charAt(j)] = matches[1].charAt(j);
                                ircSocket.IRC.options[opt[0]].push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                            }

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

        case ircNumerics.RPL_LISTSTART:
            (function () {
                websocket.sendClientEvent('list_start', {server: ''});
                websocket.kiwi.buffer.list = [];
            }());
            break;
        case ircNumerics.RPL_LISTEND:
            (function () {
                if (websocket.kiwi.buffer.list.length > 0) {
                    websocket.kiwi.buffer.list = _.sortBy(websocket.kiwi.buffer.list, function (channel) {
                        return channel.num_users;
                    });
                    websocket.sendClientEvent('list_channel', {chans: websocket.kiwi.buffer.list});
                    websocket.kiwi.buffer.list = [];
                }
                websocket.sendClientEvent('list_end', {server: ''});
            }());
            break;
        
        case ircNumerics.RPL_LIST:
            (function () {
                var parts, channel, num_users, modes, topic;

                parts = msg.params.split(' ');
                channel = parts[1];
                num_users = parts[2];
                modes = msg.trailing.split(' ', 1);
                topic = msg.trailing.substring(msg.trailing.indexOf(' ') + 1);

                //websocket.sendClientEvent('list_channel', {
                websocket.kiwi.buffer.list.push({
                    server: '',
                    channel: channel,
                    topic: topic,
                    modes: modes,
                    num_users: parseInt(num_users, 10)
                });
                
                if (websocket.kiwi.buffer.list.length > 200) {
                    websocket.kiwi.buffer.list = _.sortBy(websocket.kiwi.buffer.list, function (channel) {
                        return channel.num_users;
                    });
                    websocket.sendClientEvent('list_channel', {chans: websocket.kiwi.buffer.list});
                    websocket.kiwi.buffer.list = [];
                }
                
            }());
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
                websocket.sendClientEvent('notice', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, target: msg.params.trim(), msg: msg.trailing});
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
                } else if (msg.trailing.substr(1, 4) === 'KIWI') {
                    tmp = msg.trailing.substr(6, msg.trailing.length - 2);
                    namespace = tmp.split(' ', 1)[0];
                    websocket.sendClientEvent('kiwi', {namespace: namespace, data: tmp.substr(namespace.length + 1)});
                    
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
            caps = kiwi.config.cap_options;
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
                console.log('Kiwi thinks user is registered, but the IRC server thinks differently');
            }
            break;
        default:
            console.log("Unknown command (" + String(msg.command).toUpperCase() + ")");
        }
    } else {
        console.log("Malformed IRC line: " + data);
    }
};






/*
 * NOTE: Some IRC servers or BNC's out there incorrectly use
 * only \n as a line splitter.
 */
this.ircSocketDataHandler = function (data, websocket, ircSocket) {
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
            kiwi.parseIRCMessage(websocket, ircSocket, data[i].replace(/^\r+|\r+$/, ''));
        }
    }
};





this.httpHandler = function (request, response) {
    var uri, uri_parts, subs, useragent, agent, server_set, server, nick, debug, touchscreen, hash,
        min = {}, public_http_path;
    if (kiwi.config.handle_http) {
        uri = url.parse(request.url, true);
        uri_parts = uri.pathname.split('/');
        
        subs = uri.pathname.substr(0, 4);
        if (uri.pathname === '/js/all.js') {
            if (kiwi.cache.alljs === '') {
                public_http_path = kiwi.kiwi_root + '/' + kiwi.config.public_http;

				min.underscore = fs.readFileSync(public_http_path + 'js/underscore.min.js');
                min.util = fs.readFileSync(public_http_path + 'js/util.js');
                min.gateway = fs.readFileSync(public_http_path + 'js/gateway.js');
                min.front = fs.readFileSync(public_http_path + 'js/front.js');
                min.iscroll = fs.readFileSync(public_http_path + 'js/iscroll.js');
                min.ast = jsp.parse(min.underscore + min.util + min.gateway + min.front + min.iscroll);
                min.ast = pro.ast_mangle(min.ast);
                min.ast = pro.ast_squeeze(min.ast);
                min.final_code = pro.gen_code(min.ast);
                kiwi.cache.alljs = min.final_code;
                hash = crypto.createHash('md5').update(kiwi.cache.alljs);
                kiwi.cache.alljs_hash = hash.digest('base64');
            }
            if (request.headers['if-none-match'] === kiwi.cache.alljs_hash) {
                response.statusCode = 304;
            } else {
                response.setHeader('ETag', kiwi.cache.alljs_hash);
                response.write(kiwi.cache.alljs);
            }
            response.end();
        } else if ((subs === '/js/') || (subs === '/css') || (subs === '/img')) {
            request.addListener('end', function () {
                kiwi.fileServer.serve(request, response);
            });
        } else if (uri.pathname === '/' || uri_parts[1] === 'client') {
            useragent = (typeof request.headers === 'string') ? request.headers['user-agent'] : '';
            if (useragent.match(/android/i) !== -1) {
                agent = 'android';
                touchscreen = true;
            } else if (useragent.match(/iphone/) !== -1) {
                agent = 'iphone';
                touchscreen = true;
            } else if (useragent.match(/ipad/) !== -1) {
                agent = 'ipad';
                touchscreen = true;
            } else if (useragent.match(/ipod/) !== -1) {
                agent = 'ipod';
                touchscreen = true;
            } else {
                agent = 'normal';
                touchscreen = false;
            }
            agent = 'normal';
            touchscreen = false;

            debug = (typeof uri.query.debug !== 'undefined');
            
            if (uri_parts[1] !== 'client') {
                if (uri.query) {
                    server_set = ((typeof uri.query.server !== 'undefined') && (uri.query.server !== ''));
                    server = uri.query.server || 'irc.anonnet.org';
                    nick = uri.query.nick || '';
                } else {
                    server_set = false;
                    server = 'irc.anonnet.org';
                    nick = '';
                }
            } else {
                server_set = ((typeof uri_parts[2] !== 'undefined') && (uri_parts[2] !== ''));
                server = server_set ? uri_parts[2] : 'irc.anonnet.org';
                nick = uri.query.nick || '';
            }

            response.setHeader('X-Generated-By', 'KiwiIRC');
            hash = crypto.createHash('md5').update(touchscreen ? 't' : 'f').update(debug ? 't' : 'f').update(server_set ? 't' : 'f').update(server).update(nick).update(agent).update(JSON.stringify(kiwi.config)).digest('base64');
            if (kiwi.cache.html[hash]) {
                if (request.headers['if-none-match'] === kiwi.cache.html[hash].hash) {
                    response.statusCode = 304;
                } else {
                    response.setHeader('Etag', kiwi.cache.html[hash].hash);
                    response.write(kiwi.cache.html[hash].html);
                }
                response.end();
            } else {
                fs.readFile(__dirname + '/client/index.html.jade', 'utf8', function (err, str) {
                    var html, hash2;
                    if (!err) {
                        html = kiwi.jade.compile(str)({ "touchscreen": touchscreen, "debug": debug, "server_set": server_set, "server": server, "nick": nick, "agent": agent, "config": kiwi.config });
                        console.log(typeof html, html);
                        hash2 = crypto.createHash('md5').update(html).digest('base64');
                        kiwi.cache.html[hash] = {"html": html, "hash": hash2};
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




this.websocketListen = function (port, host, handler, secure, key, cert) {
    if (kiwi.httpServer) {
        kiwi.httpServer.close();
    }
    if (secure) {
        kiwi.httpServer = https.createServer({key: fs.readFileSync(__dirname + '/' + key), cert: fs.readFileSync(__dirname + '/' + cert)}, handler);
        kiwi.io = ws.listen(kiwi.httpServer, {secure: true});
        kiwi.httpServer.listen(port, host);
    } else {
        kiwi.httpServer = http.createServer(handler);
        kiwi.io = ws.listen(kiwi.httpServer, {secure: false});
        kiwi.httpServer.listen(port, host);
    }

    kiwi.io.set('log level', 1);
    kiwi.io.enable('browser client minification');
    kiwi.io.enable('browser client etag');
    kiwi.io.set('transports', kiwi.config.transports);

    kiwi.io.of('/kiwi').authorization(function (handshakeData, callback) {
        var address = handshakeData.address.address;
        
        if (typeof kiwi.connections[address] === 'undefined') {
            kiwi.connections[address] = {count: 0, sockets: []};
        }
        callback(null, true);
    }).on('connection', kiwi.websocketConnection);
};






this.websocketConnection = function (websocket) {
    var con;
    websocket.kiwi = {address: websocket.handshake.address.address, buffer: {list: []}};
    con = kiwi.connections[websocket.kiwi.address];

    if (con.count >= kiwi.config.max_client_conns) {
        websocket.emit('too_many_connections');
        websocket.disconnect();
    } else {
        con.count += 1;
        con.sockets.push(websocket);

        websocket.sendClientEvent = function (event_name, data) {
            var ev = kiwi.kiwi_mod.run(event_name, data, {websocket: this});
            if (ev === null) {
                return;
            }

            data.event = event_name;
            websocket.emit('message', data);
        };

        websocket.sendServerLine = function (data, eol) {
            eol = (typeof eol === 'undefined') ? '\r\n' : eol;

            try {
                websocket.ircSocket.write(data + eol);
            } catch (e) { }
        };

        websocket.on('irc connect', kiwi.websocketIRCConnect);
        websocket.on('message', kiwi.websocketMessage);
        websocket.on('disconnect', kiwi.websocketDisconnect);
    }
};





this.websocketIRCConnect = function (websocket, nick, host, port, ssl, callback) {
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
        kiwi.ircSocketDataHandler(data, websocket, ircSocket);
    });
    
    ircSocket.IRC.nick = nick;
    // Send the login data
    dns.reverse(websocket.kiwi.address, function (err, domains) {
        //console.log(domains);
        websocket.kiwi.hostname = (err) ? websocket.kiwi.address : _.first(domains);
        if ((kiwi.config.webirc) && (kiwi.config.webirc_pass[host])) {
            websocket.sendServerLine('WEBIRC ' + kiwi.config.webirc_pass[host] + ' KiwiIRC ' + websocket.kiwi.hostname + ' ' + websocket.kiwi.address);
        }
        websocket.sendServerLine('CAP LS');
        websocket.sendServerLine('NICK ' + nick);
        websocket.sendServerLine('USER kiwi_' + nick.replace(/[^0-9a-zA-Z\-_.]/, '') + ' 0 0 :' + nick);

        if ((callback) && (typeof (callback) === 'function')) {
            callback();
        }
    });
};



this.websocketMessage = function (websocket, msg, callback) {
    var args, obj;
    try {
        msg.data = JSON.parse(msg.data);
        args = msg.data.args;
        switch (msg.data.method) {
        case 'msg':
            if ((args.target) && (args.msg)) {
                obj = kiwi.kiwi_mod.run('msgsend', args, {websocket: websocket});
                if (obj !== null) {
                    websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + args.msg);
                }
            }
            break;
        case 'action':
            if ((args.target) && (args.msg)) {
                websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + 'ACTION ' + args.msg + String.fromCharCode(1));
            }
            break;

        case 'kiwi':
            if ((args.target) && (args.data)) {
                websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + 'KIWI ' + args.data + String.fromCharCode(1));
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
};



this.websocketDisconnect = function (websocket) {
	var con;

    if ((!websocket.sentQUIT) && (websocket.ircSocket)) {
        try {
            websocket.ircSocket.end('QUIT :' + kiwi.config.quit_message + '\r\n');
            websocket.sentQUIT = true;
            websocket.ircSocket.destroySoon();
        } catch (e) {
        }
    }
    con = kiwi.connections[websocket.kiwi.address];
    con.count -= 1;
    con.sockets = _.reject(con.sockets, function (sock) {
        return sock === websocket;
    });
};






this.rehash = function () {
    var changes, i,
        reload_config = kiwi.loadConfig();

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
                kiwi.websocketListen(kiwi.config.port, kiwi.config.bind_address, kiwi.httpHandler, kiwi.config.listen_ssl, kiwi.config.ssl_key, kiwi.config.ssl_cert);
                delete changes.port;
                delete changes.bind_address;
                delete changes.listen_ssl;
                delete changes.ssl_key;
                delete changes.ssl_cert;
                break;
            case 'user':
            case 'group':
                kiwi.changeUser();
                delete changes.user;
                delete changes.group;
                break;
            case 'module_dir':
            case 'modules':
                kiwi.kiwi_mod.loadModules(kiwi_root, kiwi.config);
                kiwi.kiwi_mod.printMods();
                delete changes.module_dir;
                delete changes.modules;
                break;
            }
        }
    }

    // Also clear the kiwi.cached javascript and HTML
    if (kiwi.config.handle_http) {
        kiwi.cache = {alljs: '', html: []};
    }

    return true;
};





/*
 * KiwiIRC controlling via STDIN
 */
this.manageControll = function (data) {
    var parts = data.toString().trim().split(' '),
        connections_cnt = 0,
        i;
    switch (parts[0]) {
    case 'rehash':
        console.log('Rehashing...');
        console.log(kiwi.rehash() ? 'Rehash complete' : 'Rehash failed');
        break;

	case 'recode':
        console.log('Recoding...');
        console.log(kiwi.recode() ? 'Recode complete' : 'Recode failed');
        break;

    case 'mod':
        if (parts[1] === 'reload') {
            console.log('Reloading module (' + parts[2] + ')..');
            kiwi.kiwi_mod.reloadModule(parts[2]);
        }
        break;

    case 'cache':
        if (parts[1] === 'clear') {
            kiwi.cache.html = {};
            kiwi.cache.alljs = '';
            console.log('HTML cache cleared');
        }
        break;

    case 'status':
        for (i in kiwi.connections) {
            connections_cnt = connections_cnt + parseInt(kiwi.connections[i].count, 10);
        }
        console.log(connections_cnt.toString() + ' connected clients');
        break;

    default:
        console.log('Unknown command \'' + parts[0] + '\'');
    }
};

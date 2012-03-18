/*jslint sloppy: true, continue: true, forin: true, regexp: true, undef: false, node: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
/*globals kiwi_root */
/* Fuck you, git. */
var tls = null,
    net = null,
    http = null,
    https = null,
    fs = null,
    url = null,
    dns = null,
    crypto = null,
    events = null,
    util = null,
    ws = null,
    jsp = null,
    pro = null,
    _ = null,
    starttls = null,
    kiwi = null;

this.init = function (objs) {
    tls = objs.tls;
    net = objs.net;
    http = objs.http;
    https = objs.https;
    fs = objs.fs;
    url = objs.url;
    dns = objs.dns;
    crypto = objs.crypto;
    events = objs.events;
    util = objs.util;
    ws = objs.ws;
    jsp = objs.jsp;
    pro = objs.pro;
    _ = objs._;
    starttls = objs.starttls;
    kiwi = require('./kiwi.js');

    util.inherits(this.IRCConnection, events.EventEmitter);
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
            kiwi.log('Failed to set gid: ' + err);
            process.exit();
        }
    }

    if (typeof kiwi.config.user !== 'undefined' && kiwi.config.user !== '') {
        try {
            process.setuid(kiwi.config.user);
        } catch (e) {
            kiwi.log('Failed to set uid: ' + e);
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
    RPL_TOPICWHOTIME:       '333',
    RPL_NAMEREPLY:          '353',
    RPL_ENDOFNAMES:         '366',
    RPL_BANLIST:            '367',
    RPL_ENDOFBANLIST:       '368',
    RPL_MOTD:               '372',
    RPL_MOTDSTART:          '375',
    RPL_ENDOFMOTD:          '376',
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

this.bindIRCCommands = function (irc_connection, websocket) {
    var bound_events = [],
        bindCommand = function (command, listener) {
            command = 'irc_' + command;
            irc_connection.on(command, listener);
            bound_events.push({"command": command, "listener": listener});
        };

    bindCommand('PING', function (msg) {
        websocket.sendServerLine('PONG ' + msg.trailing);
    });

    bindCommand(ircNumerics.RPL_WELCOME, function (msg) {
        if (irc_connection.IRC.CAP.negotiating) {
            irc_connection.IRC.CAP.negotiating = false;
            irc_connection.IRC.CAP.enabled = [];
            irc_connection.IRC.CAP.requested = [];
            irc_connection.IRC.registered = true;
        }
        var nick =  msg.params.split(' ')[0];
        websocket.sendClientEvent('connect', {connected: true, host: null, nick: nick});
    });

    bindCommand(ircNumerics.RPL_ISUPPORT, function (msg) {
        var opts = msg.params.split(" "),
            opt,
            i,
            j,
            regex,
            matches;
        for (i = 0; i < opts.length; i++) {
            opt = opts[i].split("=", 2);
            opt[0] = opt[0].toUpperCase();
            irc_connection.IRC.options[opt[0]] = (typeof opt[1] !== 'undefined') ? opt[1] : true;
            if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES', 'NAMESX'], opt[0])) {
                if (opt[0] === 'PREFIX') {
                    regex = /\(([^)]*)\)(.*)/;
                    matches = regex.exec(opt[1]);
                    if ((matches) && (matches.length === 3)) {
                        irc_connection.IRC.options[opt[0]] = [];
                        for (j = 0; j < matches[2].length; j++) {
                            irc_connection.IRC.options[opt[0]].push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                        }

                    }
                }
                if (opt[0] === 'NAMESX') {
                    websocket.sendServerLine('PROTOCTL NAMESX');
                }
            }
        }

        websocket.sendClientEvent('options', {server: '', "options": irc_connection.IRC.options});
    });

    bindCommand(ircNumerics.RPL_ENDOFWHOIS, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: true});
    });

    bindCommand(ircNumerics.RPL_WHOISUSER, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
    });

    bindCommand(ircNumerics.RPL_WHOISSERVER, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
    });

    bindCommand(ircNumerics.RPL_WHOISOPERATOR, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
    });

    bindCommand(ircNumerics.RPL_WHOISCHANNELS, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
    });

    bindCommand(ircNumerics.RPL_WHOISMODES, function (msg) {
        websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
    });

    bindCommand(ircNumerics.RPL_LISTSTART, function (msg) {
        websocket.sendClientEvent('list_start', {server: ''});
        websocket.kiwi.buffer.list = [];
    });

    bindCommand(ircNumerics.RPL_LISTEND, function (msg) {
        if (websocket.kiwi.buffer.list.length > 0) {
            websocket.kiwi.buffer.list = _.sortBy(websocket.kiwi.buffer.list, function (channel) {
                return channel.num_users;
            });
            websocket.sendClientEvent('list_channel', {chans: websocket.kiwi.buffer.list});
            websocket.kiwi.buffer.list = [];
        }
        websocket.sendClientEvent('list_end', {server: ''});
    });

    bindCommand(ircNumerics.RPL_LIST, function (msg) {
        var parts, channel, num_users, topic;

        parts = msg.params.split(' ');
        channel = parts[1];
        num_users = parts[2];
        topic = msg.trailing;

        //websocket.sendClientEvent('list_channel', {
        websocket.kiwi.buffer.list.push({
            server: '',
            channel: channel,
            topic: topic,
            //modes: modes,
            num_users: parseInt(num_users, 10)
        });

        if (websocket.kiwi.buffer.list.length > 200) {
            websocket.kiwi.buffer.list = _.sortBy(websocket.kiwi.buffer.list, function (channel) {
                return channel.num_users;
            });
            websocket.sendClientEvent('list_channel', {chans: websocket.kiwi.buffer.list});
            websocket.kiwi.buffer.list = [];
        }
    });

    bindCommand(ircNumerics.RPL_WHOISIDLE, function (msg) {
        var params = msg.params.split(" ", 4),
            rtn = {server: '', nick: params[1], idle: params[2]};
        if (params[3]) {
            rtn.logon = params[3];
        }
        websocket.sendClientEvent('whois', rtn);
    });

    bindCommand(ircNumerics.RPL_MOTD, function (msg) {
        websocket.kiwi.buffer.motd += msg.trailing + '\n';
    });

    bindCommand(ircNumerics.RPL_MOTDSTART, function (msg) {
        websocket.kiwi.buffer.motd = '';
    });

    bindCommand(ircNumerics.RPL_ENDOFMOTD, function (msg) {
        websocket.sendClientEvent('motd', {server: '', 'msg': websocket.kiwi.buffer.motd});
    });

    bindCommand(ircNumerics.RPL_NAMEREPLY, function (msg) {
        var params = msg.params.split(" "),
            chan = params[2],
            users = msg.trailing.split(" "),
            nicklist = [],
            i = 0;

        _.each(users, function (user) {
            var j, k, modes = [];
            for (j = 0; j < user.length; j++) {
                for (k = 0; k < irc_connection.IRC.options.PREFIX.length; k++) {
                    if (user.charAt(j) === irc_connection.IRC.options.PREFIX[k].symbol) {
                        modes.push(irc_connection.IRC.options.PREFIX[k].mode);
                    }
                }
            }
            nicklist.push({nick: user, modes: modes});
            if (i++ >= 50) {
                websocket.sendClientEvent('userlist', {server: '', 'users': nicklist, channel: chan});
                nicklist = [];
                i = 0;
            }
        });
        if (i > 0) {
            websocket.sendClientEvent('userlist', {server: '', "users": nicklist, channel: chan});
        } else {
            kiwi.log("oops");
        }
    });

    bindCommand(ircNumerics.RPL_ENDOFNAMES, function (msg) {
        websocket.sendClientEvent('userlist_end', {server: '', channel: msg.params.split(" ")[1]});
    });

    bindCommand(ircNumerics.ERR_LINKCHANNEL, function (msg) {
        var params = msg.params.split(" ");
        websocket.sendClientEvent('channel_redirect', {from: params[1], to: params[2]});
    });

    bindCommand(ircNumerics.ERR_NOSUCHNICK, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'no_such_nick', nick: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.RPL_BANLIST, function (msg) {
        var params = msg.params.split(" ");
        kiwi.log(params);
        websocket.sendClientEvent('banlist', {server: '', channel: params[1], banned: params[2], banned_by: params[3], banned_at: params[4]});
    });

    bindCommand(ircNumerics.RPL_ENDOFBANLIST, function (msg) {
        websocket.sendClientEvent('banlist_end', {server: '', channel: msg.params.split(" ")[1]});
    });

    bindCommand('JOIN', function (msg) {
        var channel;

        // Some BNC's send malformed JOIN causing the channel to be as a
        // parameter instead of trailing.
        if (typeof msg.trailing === 'string' && msg.trailing !== '') {
            channel = msg.trailing;
        } else if (typeof msg.params === 'string' && msg.params !== '') {
            channel = msg.params;
        }

        websocket.sendClientEvent('join', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: channel});
        if (msg.nick === irc_connection.IRC.nick) {
            websocket.sendServerLine('NAMES ' + msg.trailing);
        }
    });

    bindCommand('PART', function (msg) {
        websocket.sendClientEvent('part', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), message: msg.trailing});
    });

    bindCommand('KICK', function (msg) {
        var params = msg.params.split(" ");
        websocket.sendClientEvent('kick', {kicked: params[1], nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: params[0].trim(), message: msg.trailing});
    });

    bindCommand('QUIT', function (msg) {
        websocket.sendClientEvent('quit', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, message: msg.trailing});
    });

    bindCommand('NOTICE', function (msg) {
        if ((msg.trailing.charAt(0) === String.fromCharCode(1)) && (msg.trailing.charAt(msg.trailing.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP response
            websocket.sendClientEvent('ctcp_response', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(1, msg.trailing.length - 2)});
        } else {
            websocket.sendClientEvent('notice', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, target: msg.params.trim(), msg: msg.trailing});
        }
    });

    bindCommand('NICK', function (msg) {
        websocket.sendClientEvent('nick', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, newnick: msg.trailing});
    });

    bindCommand('TOPIC', function (msg) {
        var obj = {nick: msg.nick, channel: msg.params, topic: msg.trailing};
        websocket.sendClientEvent('topic', obj);
    });

    bindCommand(ircNumerics.RPL_TOPIC, function (msg) {
        var obj = {nick: '', channel: msg.params.split(" ")[1], topic: msg.trailing};
        websocket.sendClientEvent('topic', obj);
    });

    bindCommand(ircNumerics.RPL_NOTOPIC, function (msg) {
        var obj = {nick: '', channel: msg.params.split(" ")[1], topic: ''};
        websocket.sendClientEvent('topic', obj);
    });

    bindCommand(ircNumerics.RPL_TOPICWHOTIME, function (msg) {
        var parts = msg.params.split(' '),
            nick = parts[2],
            channel = parts[1],
            when = parts[3],
            obj = {nick: nick, channel: channel, when: when};
        websocket.sendClientEvent('topicsetby', obj);
    });

    bindCommand('MODE', function (msg) {
        var opts = msg.params.split(" "),
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
    });

    bindCommand('PRIVMSG', function (msg) {
        var tmp, namespace, obj;
        if ((msg.trailing.charAt(0) === String.fromCharCode(1)) && (msg.trailing.charAt(msg.trailing.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP request
            if (msg.trailing.substr(1, 6) === 'ACTION') {
                websocket.sendClientEvent('action', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(7, msg.trailing.length - 2)});
            } else if (msg.trailing.substr(1, 4) === 'KIWI') {
                tmp = msg.trailing.substr(6, msg.trailing.length - 2);
                namespace = tmp.split(' ', 1)[0];
                websocket.sendClientEvent('kiwi', {namespace: namespace, data: tmp.substr(namespace.length + 1)});

            } else if (msg.trailing.substr(1, 7) === 'VERSION') {
                irc_connection.write('NOTICE ' + msg.nick + ' :' + String.fromCharCode(1) + 'VERSION KiwiIRC' + String.fromCharCode(1) + '\r\n');
            } else {
                websocket.sendClientEvent('ctcp_request', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(1, msg.trailing.length - 2)});
            }
        } else {
            obj = {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing};
            websocket.sendClientEvent('msg', obj);
        }
    });

    bindCommand('CAP', function (msg) {
        var caps = kiwi.config.cap_options,
            options = msg.trailing.split(" "),
            opts;

        switch (_.last(msg.params.split(" "))) {
        case 'LS':
            opts = '';
            _.each(_.intersect(caps, options), function (cap) {
                if (opts !== '') {
                    opts += " ";
                }
                opts += cap;
                irc_connection.IRC.CAP.requested.push(cap);
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
                irc_connection.IRC.CAP.enabled.push(cap);
            });
            if (_.last(msg.params.split(" ")) !== '*') {
                irc_connection.IRC.CAP.requested = [];
                irc_connection.IRC.CAP.negotiating = false;
                websocket.sendServerLine('CAP END');
            }
            break;
        case 'NAK':
            irc_connection.IRC.CAP.requested = [];
            irc_connection.IRC.CAP.negotiating = false;
            websocket.sendServerLine('CAP END');
            break;
        }
    });
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
                //log(ircSocket);
            } catch (e) {
                kiwi.log(e);
            }
            break;*/
    bindCommand(ircNumerics.ERR_CANNOTSENDTOCHAN, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'cannot_send_to_chan', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_TOOMANYCHANNELS, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'too_many_channels', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_USERNOTINCHANNEL, function (msg) {
        var params = msg.params.split(" ");
        websocket.sendClientEvent('irc_error', {error: 'user_not_in_channel', nick: params[0], channel: params[1], reason: msg.trainling});
    });

    bindCommand(ircNumerics.ERR_NOTONCHANNEL, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'not_on_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_CHANNELISFULL, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'channel_is_full', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_INVITEONLYCHAN, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'invite_only_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_BANNEDFROMCHAN, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'banned_from_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_BADCHANNELKEY, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'bad_channel_key', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_CHANOPRIVSNEEDED, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'chanop_privs_needed', channel: msg.params.split(" ")[1], reason: msg.trailing});
    });

    bindCommand(ircNumerics.ERR_NICKNAMEINUSE, function (msg) {
        websocket.sendClientEvent('irc_error', {error: 'nickname_in_use', nick: _.last(msg.params.split(" ")), reason: msg.trailing});
    });

    bindCommand('ERROR', function (msg) {
        irc_connection.end();
        websocket.sendClientEvent('irc_error', {error: 'error', reason: msg.trailing});
        websocket.disconnect();
    });

    bindCommand(ircNumerics.ERR_NOTREGISTERED, function (msg) {
        if (irc_connection.IRC.registered) {
            kiwi.log('Kiwi thinks user is registered, but the IRC server thinks differently');
        }
    });

    return bound_events;
};

this.rebindIRCCommands = function () {
    _.each(kiwi.connections, function (con) {
        _.each(con.sockets, function (sock) {
            sock.ircConnection.rebindIRCCommands();
        });
    });
};


this.httpHandler = function (request, response, serverconf) {
    var uri, uri_parts, subs, useragent, agent, server_set, serverconf, nick, debug, touchscreen, hash,
        min = {}, public_http_path, port, ssl, obj, args, ircuri, target, modifiers, query,
        secure = serverconf.secure || false;

    try {
        if (kiwi.config.handle_http) {
            // Run through any plugins..
            args = {request: request, response: response, ssl: secure};
            obj = kiwi.kiwi_mod.run('http', args);
            if (obj === null) {
                return;
            }
            response = args.response;

            uri = url.parse(request.url, true);
            uri_parts = uri.pathname.split('/');

            subs = uri.pathname.substr(0, 4);
            public_http_path = kiwi.kiwi_root + '/' + kiwi.config.public_http;

            if (typeof uri.query.ircuri !== 'undefined') {
                ircuri = url.parse(uri.query.ircuri, true);
                if (ircuri.protocol === 'irc:') {
                    uri_parts = /^\/([^,\?]*)((,[^,\?]*)*)?$/.exec(ircuri.pathname);
                    target = uri_parts[1];
                    modifiers = (typeof uri_parts[2] !== 'undefined') ? uri_parts[2].split(',') : [];
                    query = ircuri.query;

                    nick = _.detect(modifiers, function (mod) {
                        return mod === ',isnick';
                    });
                    kiwi.log(request.headers);
                    response.statusCode = 303;
                    response.setHeader('Location', 'http' + ((secure) ? 's' : '') + '://' + request.headers.host + '/client/' + ircuri.host + '/' + ((!nick) ? target : ''));
                    response.end();
                }
            } else if (uri.pathname === '/js/all.js') {
                if (kiwi.cache.alljs === '') {

                    min.underscore = fs.readFileSync(public_http_path + 'js/underscore.min.js');
                    min.util = fs.readFileSync(public_http_path + 'js/util.js');
                    min.backbone = fs.readFileSync(public_http_path + 'js/backbone-git.js');
                    min.gateway = fs.readFileSync(public_http_path + 'js/gateway.js');
                    min.model = fs.readFileSync(public_http_path + 'js/model.js');
                    min.view = fs.readFileSync(public_http_path + 'js/view.js');
                    min.front = fs.readFileSync(public_http_path + 'js/front.js');
                    min.front_events = fs.readFileSync(public_http_path + 'js/front.events.js');
                    min.front_ui = fs.readFileSync(public_http_path + 'js/front.ui.js');
                    min.iscroll = fs.readFileSync(public_http_path + 'js/iscroll.js');
                    min.ast = jsp.parse(min.underscore + min.util + min.backbone + min.gateway + min.model + min.view + min.front + min.front_events + min.front_ui + min.iscroll);
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
                    response.setHeader('Content-type', 'application/javascript');
                    response.setHeader('ETag', kiwi.cache.alljs_hash);
                    if ((secure) && (serverconf.hsts)) {
                        response.setHeader("Strict-Transport-Security", "max-age=604 800");
                    }
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

                ssl = secure;   // ssl is passed to the client
                port = ssl ? kiwi.config.client_defaults.port_ssl : kiwi.config.client_defaults.port;
                if (uri_parts[1] !== 'client') {
                    if (uri.query) {
                        server_set = ((typeof uri.query.server !== 'undefined') && (uri.query.server !== ''));
                        server = uri.query.server || kiwi.config.client_defaults.server;
                        nick = uri.query.nick || '';
                    } else {
                        server_set = false;
                        server = kiwi.config.client_defaults.server;
                        nick = '';
                    }
                } else {
                    server_set = ((typeof uri_parts[2] !== 'undefined') && (uri_parts[2] !== ''));
                    server = server_set ? uri_parts[2] : kiwi.config.client_defaults.server;
                    if (server.search(/:/) > 0) {
                        port = server.substring(server.search(/:/) + 1);
                        server = server.substring(0, server.search(/:/));
                        if (port[0] === '+') {
                            port = port.substring(1);
                            ssl = true;
                        } else {
                            ssl = false;
                        }
                    }
                    nick = uri.query.nick || '';
                }

                // Set the default nick if one isn't provided
                if (nick === '') {
                    nick = 'kiwi_?';
                }

                // Set any random numbers if needed
                nick = nick.replace('?', Math.floor(Math.random() * 100000).toString());

                response.setHeader('X-Generated-By', 'KiwiIRC');
                hash = crypto.createHash('md5').update(touchscreen ? 't' : 'f')
                    .update(debug ? 't' : 'f')
                    .update(server_set ? 't' : 'f')
                    .update(secure ? 't' : 'f')
                    .update(server)
                    .update(port.toString())
                    .update(ssl  ? 't' : 'f')
                    .update(nick)
                    .update(agent)
                    .update(JSON.stringify(kiwi.config))
                    .digest('base64');
                if (kiwi.cache.html[hash]) {
                    if (request.headers['if-none-match'] === kiwi.cache.html[hash].hash) {
                        response.statusCode = 304;
                    } else {
                        response.setHeader('Etag', kiwi.cache.html[hash].hash);
                        response.setHeader('Content-type', 'text/html');
                        if ((secure) && (serverconf.hsts)) {
                            response.setHeader("Strict-Transport-Security", "max-age=604 800");
                        }
                        response.write(kiwi.cache.html[hash].html);
                    }
                    response.end();
                } else {
                    fs.readFile(public_http_path + 'index.html.jade', 'utf8', function (err, str) {
                        var html, hash2;
                        if (!err) {
                            try {
                                html = kiwi.jade.compile(str)({ "touchscreen": touchscreen, "debug": debug, "secure": secure, "server_set": server_set, "server": server, "port": port, "ssl": ssl, "nick": nick, "agent": agent, "config": kiwi.config });
                                hash2 = crypto.createHash('md5').update(html).digest('base64');
                                kiwi.cache.html[hash] = {"html": html, "hash": hash2};
                                if (request.headers['if-none-match'] === hash2) {
                                    response.statusCode = 304;
                                } else {
                                    response.setHeader('Etag', hash2);
                                    response.setHeader('Content-type', 'text/html');
                                    if ((secure) && (serverconf.hsts)) {
                                        response.setHeader("Strict-Transport-Security", "max-age=604 800");
                                    }
                                    response.write(html);
                                }
                            } catch (e) {
                                response.statusCode = 500;
                                kiwi.log(e);
                            }
                        } else {
                            kiwi.log(err);
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

    } catch (e) {
        kiwi.log('ERROR app.httpHandler()');
        kiwi.log(e);
    }
};




this.websocketListen = function (servers, handler) {
    if (kiwi.httpServers.length > 0) {
        _.each(kiwi.httpServers, function (hs) {
            hs.close();
        });
        kiwi.httpsServers = [];
    }

    _.each(servers, function (server) {
        var hs, opts;
        if (server.secure === true) {
            // Start some SSL server up
            opts = {
                key: fs.readFileSync(__dirname + '/' + server.ssl_key),
                cert: fs.readFileSync(__dirname + '/' + server.ssl_cert)
            };

            // Do we have an intermediate certificate?
            if (typeof server.ssl_ca !== 'undefined') {
                opts.ca = fs.readFileSync(__dirname + '/' + server.ssl_ca);
            }

            hs = https.createServer(opts, function (request, response) {
                handler(request, response, server);
            });
            kiwi.io.push(ws.listen(hs, {secure: true}));
            hs.listen(server.port, server.address);
            kiwi.log('Listening on ' + server.address + ':' + server.port.toString() + ' with SSL');
        } else {
            // Start some plain-text server up
            hs = http.createServer(function (request, response) {
                handler(request, response, server);
            });
            kiwi.io.push(ws.listen(hs, {secure: false}));
            hs.listen(server.port, server.address);
            kiwi.log('Listening on ' + server.address + ':' + server.port.toString() + ' without SSL');
        }

        kiwi.httpServers.push(hs);
    });

    _.each(kiwi.io, function (io) {
        io.set('log level', 1);
        io.enable('browser client minification');
        io.enable('browser client etag');
        io.set('transports', kiwi.config.transports);

        io.of('/kiwi').authorization(function (handshakeData, callback) {
            var address = handshakeData.address.address;
            if (typeof kiwi.connections[address] === 'undefined') {
                kiwi.connections[address] = {count: 0, sockets: []};
            }
            callback(null, true);
        }).on('connection', kiwi.websocketConnection);
        io.of('/kiwi').on('error', console.log);
    });
};






this.websocketConnection = function (websocket) {
    var con;
    kiwi.log("New connection!");
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

        websocket.sendServerLine = function (data, eol, callback) {
            if ((arguments.length < 3) && (typeof eol === 'function')) {
                callback = eol;
            }
            eol = (typeof eol !== 'string') ? '\r\n' : eol;

            try {
                websocket.ircConnection.write(data + eol, 'utf-8', callback);
            } catch (e) { }
        };

        websocket.on('irc connect', function (nick, host, port, ssl, password, callback) {
            websocket.ircConnection = new kiwi.IRCConnection(this, nick, host, port, ssl, password, callback);
        });
        websocket.on('message', kiwi.websocketMessage);
        websocket.on('disconnect', kiwi.websocketDisconnect);
        websocket.on('error', console.log);
    }
};


this.IRCConnection = function (websocket, nick, host, port, ssl, password, callback) {
    var ircSocket,
        that = this,
        regex,
        onConnectHandler,
        bound_events;

    events.EventEmitter.call(this);

    onConnectHandler = function () {
        that.IRC.nick = nick;
        // Send the login data
        dns.reverse(websocket.kiwi.address, function (err, domains) {
            websocket.kiwi.hostname = (err) ? websocket.kiwi.address : _.first(domains);
            if ((kiwi.config.webirc) && (kiwi.config.webirc_pass[host])) {
                websocket.sendServerLine('WEBIRC ' + kiwi.config.webirc_pass[host] + ' KiwiIRC ' + websocket.kiwi.hostname + ' ' + websocket.kiwi.address);
            }
            if (password) {
                websocket.sendServerLine('PASS ' + password);
            }
            websocket.sendServerLine('CAP LS');
            websocket.sendServerLine('NICK ' + nick);
            websocket.sendServerLine('USER kiwi_' + nick.replace(/[^0-9a-zA-Z\-_.]/, '') + ' 0 0 :' + nick);

            that.connected = true;
            that.emit('connect');
        });
    };

    if (!ssl) {
        ircSocket = net.createConnection(port, host);
        ircSocket.on('connect', onConnectHandler);
    } else {
        ircSocket = tls.connect(port, host, {}, onConnectHandler);
    }

    ircSocket.setEncoding('utf-8');
    this.IRC = {options: {}, CAP: {negotiating: true, requested: [], enabled: []}, registered: false};

    this.on('error', function (e) {
        if (that.IRC.registered) {
            websocket.emit('disconnect');
        } else {
            websocket.emit('error', e.message);
        }
    });

    ircSocket.on('error', function (e) {
        that.connected = false;
        that.emit('error', e);
        that.destroySoon();
    });

    if (typeof callback === 'function') {
        this.on('connect', callback);
    }

    regex = /^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@?([a-z0-9\.\-:\/]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;
    ircSocket.holdLast = false;
    ircSocket.held = '';
    ircSocket.on('data', function (data) {
        var i, msg;
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
                msg = regex.exec(data[i].replace(/^\r+|\r+$/, ''));
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
                    that.emit('irc_' + msg.command.toUpperCase(), msg);
                    if (that.listeners('irc_' + msg.command.toUpperCase()).length < 1) {
                        kiwi.log("Unknown command (" + String(msg.command).toUpperCase() + ")");
                    }
                } else {
                    kiwi.log("Malformed IRC line: " + data[i].replace(/^\r+|\r+$/, ''));
                }
            }
        }
    });

    if (callback) {
        ircSocket.on('connect', callback);
    }

    ircSocket.on('end', function () {
        that.connected = false;
        that.emit('disconnect', false);
    });

    ircSocket.on('close', function (had_error) {
        that.connected = false;
        that.emit('disconnect', had_error);
    });

    ircSocket.on('timeout', function () {
        ircSocket.destroy();
        that.connected = false;
        that.emit('error', {message: 'Connection timed out'});
    });

    ircSocket.on('drain', function () {
        that.emit('drain');
    });

    this.write = function (data, encoding, callback) {
        ircSocket.write(data, encoding, callback);
    };

    this.end = function (data, encoding, callback) {
        that.connected = false;
        ircSocket.end(data, encoding, callback);
    };

    this.destroySoon = function () {
        ircSocket.destroySoon();
    };

    bound_events = kiwi.bindIRCCommands(this, websocket);

    this.rebindIRCCommands = function () {
        _.each(bound_events, function (event) {
            that.removeListener(event.command, event.listener);
        });
        bound_events = kiwi.bindIRCCommands(that, websocket);
    };
    
    that.on('error', console.log);
    
};



this.websocketMessage = function (websocket, msg, callback) {
    var args, obj, channels, keys;
    //try {
        if ((callback) && (typeof (callback) !== 'function')) {
            callback = null;
        }
        try {
            msg.data = JSON.parse(msg.data);
        } catch (e) {
            kiwi.log('[app.websocketMessage] JSON parsing error ' + msg.data);
            return;
        }
        args = msg.data.args;
        switch (msg.data.method) {
        case 'privmsg':
            if ((args.target) && (args.msg)) {
                obj = kiwi.kiwi_mod.run('msgsend', args, {websocket: websocket});
                if (obj !== null) {
                    websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + args.msg, callback);
                }
            }
            break;
        case 'ctcp':
            if ((args.target) && (args.type)) {
                if (args.request) {
                    websocket.sendServerLine('PRIVMSG ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
                } else {
                    websocket.sendServerLine('NOTICE ' + args.target + ' :' + String.fromCharCode(1) + args.type.toUpperCase() + ' ' + args.params + String.fromCharCode(1), callback);
                }
            }
            break;

        case 'raw':
            websocket.sendServerLine(args.data, callback);
            break;

        case 'join':
            if (args.channel) {
                channels = args.channel.split(",");
                keys = (args.key) ? args.key.split(",") : [];
                _.each(channels, function (chan, index) {
                    websocket.sendServerLine('JOIN ' + chan + ' ' + (keys[index] || ''), callback);
                });
            }
            break;

        case 'part':
            if (args.channel) {
                _.each(args.channel.split(","), function (chan) {
                    websocket.sendServerLine('PART ' + chan, callback);
                });
            }
            break;

        case 'topic':
            if (args.channel) {
                if (args.topic) {
                    websocket.sendServerLine('TOPIC ' + args.channel + ' :' + args.topic, callback);
                } else {
                    websocket.sendServerLine('TOPIC ' + args.channel, callback);
                }
            }
            break;

        case 'kick':
            if ((args.channel) && (args.nick)) {
                websocket.sendServerLine('KICK ' + args.channel + ' ' + args.nick + ':' + args.reason, callback);
            }
            break;

        case 'quit':
            websocket.ircConnection.end('QUIT :' + args.message + '\r\n');
            websocket.sentQUIT = true;
            websocket.ircConnection.destroySoon();
            websocket.disconnect();
            break;

        case 'notice':
            if ((args.target) && (args.msg)) {
                websocket.sendServerLine('NOTICE ' + args.target + ' :' + args.msg, callback);
            }
            break;

        case 'mode':
            if ((args.target) && (args.mode)) {
                websocket.sendServerLine('MODE ' + args.target + ' ' + args.mode + ' ' + args.params, callback);
            }
            break;

        case 'nick':
            if (args.nick) {
                websocket.sendServerLine('NICK ' + args.nick, callback);
            }
            break;

        case 'kiwi':
            if ((args.target) && (args.data)) {
                websocket.sendServerLine('PRIVMSG ' + args.target + ': ' + String.fromCharCode(1) + 'KIWI ' + args.data + String.fromCharCode(1), callback);
            }
            break;
        default:
        }
    //} catch (e) {
    //    kiwi.log("Caught error (app.websocketMessage): " + e);
    //}
};



this.websocketDisconnect = function (websocket) {
    var con;

    if ((!websocket.sentQUIT) && (websocket.ircConnection.connected)) {
        try {
            websocket.ircConnection.end('QUIT :' + kiwi.config.quit_message + '\r\n');
            websocket.sentQUIT = true;
            websocket.ircConnection.destroySoon();
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
        kiwi.log('%s config changes: \n', Object.keys(changes).length, changes);
        for (i in changes) {
            switch (i) {
            case 'servers':
                kiwi.websocketListen(kiwi.config.servers, kiwi.httpHandler);
                delete changes.ports;
                delete changes.bind_address;
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
        kiwi.log('Rehashing...');
        kiwi.log(kiwi.rehash() ? 'Rehash complete' : 'Rehash failed');
        break;

    case 'recode':
        kiwi.log('Recoding...');
        kiwi.log(kiwi.recode() ? 'Recode complete' : 'Recode failed');
        break;

    case 'mod':
        if (parts[1] === 'reload') {
            if (!parts[2]) {
                kiwi.log('Usage: mod reload module_name');
                return;
            }

            kiwi.log('Reloading module (' + parts[2] + ')..');
            kiwi.kiwi_mod.reloadModule(parts[2]);
        } else if (parts[1] === 'list') {
            kiwi.kiwi_mod.printMods();
        }
        break;

    case 'cache':
        if (parts[1] === 'clear') {
            kiwi.cache.html = {};
            kiwi.cache.alljs = '';
            kiwi.log('HTML cache cleared');
        }
        break;

    case 'status':
        for (i in kiwi.connections) {
            connections_cnt = connections_cnt + parseInt(kiwi.connections[i].count, 10);
        }
        kiwi.log(connections_cnt.toString() + ' connected clients');
        break;

    default:
        kiwi.log('Unknown command \'' + parts[0] + '\'');
    }
};

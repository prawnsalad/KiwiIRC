var _ = require('lodash'),
    irc_numerics,
    IrcCommands,
    handlers,
    unknownCommand;

irc_numerics = {
    '001': 'RPL_WELCOME',
    '004': 'RPL_MYINFO',
    '005': 'RPL_ISUPPORT',
    '006': 'RPL_MAPMORE',
    '007': 'RPL_MAPEND',
    '250': 'RPL_STATSCONN',
    '251': 'RPL_LUSERCLIENT',
    '252': 'RPL_LUSEROP',
    '253': 'RPL_LUSERUNKNOWN',
    '254': 'RPL_LUSERCHANNELS',
    '255': 'RPL_LUSERME',
    '265': 'RPL_LOCALUSERS',
    '266': 'RPL_GLOBALUSERS',
    '301': 'RPL_AWAY',
    '307': 'RPL_WHOISREGNICK',
    '311': 'RPL_WHOISUSER',
    '312': 'RPL_WHOISSERVER',
    '313': 'RPL_WHOISOPERATOR',
    '314': 'RPL_WHOWASUSER',
    '315': 'RPL_ENDOFWHO',
    '317': 'RPL_WHOISIDLE',
    '318': 'RPL_ENDOFWHOIS',
    '319': 'RPL_WHOISCHANNELS',
    '321': 'RPL_LISTSTART',
    '322': 'RPL_LIST',
    '323': 'RPL_LISTEND',
    '324': 'RPL_CHANNELMODEIS',
    '328': 'RPL_CHANNEL_URL',
    '329': 'RPL_CREATIONTIME',
    '330': 'RPL_WHOISACCOUNT',
    '331': 'RPL_NOTOPIC',
    '332': 'RPL_TOPIC',
    '333': 'RPL_TOPICWHOTIME',
    '341': 'RPL_INVITING',
    '352': 'RPL_WHOREPLY',
    '353': 'RPL_NAMEREPLY',
    '364': 'RPL_LINKS',
    '365': 'RPL_ENDOFLINKS',
    '366': 'RPL_ENDOFNAMES',
    '367': 'RPL_BANLIST',
    '368': 'RPL_ENDOFBANLIST',
    '369': 'RPL_ENDOFWHOWAS',
    '372': 'RPL_MOTD',
    '375': 'RPL_MOTDSTART',
    '376': 'RPL_ENDOFMOTD',
    '378': 'RPL_WHOISHOST',
    '379': 'RPL_WHOISMODES',
    '401': 'ERR_NOSUCHNICK',
    '404': 'ERR_CANNOTSENDTOCHAN',
    '405': 'ERR_TOOMANYCHANNELS',
    '406': 'ERR_WASNOSUCHNICK',
    '421': 'ERR_UNKNOWNCOMMAND',
    '422': 'ERR_NOMOTD',
    '432': 'ERR_ERRONEUSNICKNAME',
    '433': 'ERR_NICKNAMEINUSE',
    '441': 'ERR_USERNOTINCHANNEL',
    '442': 'ERR_NOTONCHANNEL',
    '443': 'ERR_USERONCHANNEL',
    '451': 'ERR_NOTREGISTERED',
    '464': 'ERR_PASSWDMISMATCH',
    '470': 'ERR_LINKCHANNEL',
    '471': 'ERR_CHANNELISFULL',
    '473': 'ERR_INVITEONLYCHAN',
    '474': 'ERR_BANNEDFROMCHAN',
    '475': 'ERR_BADCHANNELKEY',
    '481': 'ERR_NOPRIVILEGES',
    '482': 'ERR_CHANOPRIVSNEEDED',
    '670': 'RPL_STARTTLS',
    '671': 'RPL_WHOISSECURE',
    '900': 'RPL_SASLAUTHENTICATED',
    '903': 'RPL_SASLLOGGEDIN',
    '904': 'ERR_SASLNOTAUTHORISED',
    '906': 'ERR_SASLABORTED',
    '907': 'ERR_SASLALREADYAUTHED'
};


IrcCommands = function (irc_connection) {
    this.irc_connection = irc_connection;
};
module.exports = IrcCommands;

IrcCommands.prototype.dispatch = function (command, data) {
    command += '';
    if (irc_numerics[command]) {
        command = irc_numerics[command];
    }
    if (handlers[command]) {
        handlers[command].call(this, data);
    } else {
        unknownCommand.call(this, command, data);
    }
};

IrcCommands.addHandler = function (command, handler) {
    if (typeof handler !== 'function') {
        return false;
    }
    handlers[command] = handler;
};

IrcCommands.addNumeric = function (numeric, handler_name) {
    irc_numerics[numeric + ''] = handler_name +'';
};

unknownCommand = function (command, data) {
    var params = _.clone(data.params);

    this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' unknown_command', {
        command: command,
        params: params
    });
};


handlers = {
    'RPL_WELCOME': function (command) {
        var nick =  command.params[0];
        this.irc_connection.registered = true;
        this.cap_negotiation = false;
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' connect', {
            nick: nick
        });
    },

    'RPL_ISUPPORT': function (command) {
        var options, i, option, matches, j;
        options = command.params;
        for (i = 1; i < options.length; i++) {
            option = options[i].split("=", 2);
            option[0] = option[0].toUpperCase();
            this.irc_connection.options[option[0]] = (typeof option[1] !== 'undefined') ? option[1] : true;
            if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES', 'CHANMODES', 'NAMESX'], option[0])) {
                if (option[0] === 'PREFIX') {
                    matches = /\(([^)]*)\)(.*)/.exec(option[1]);
                    if ((matches) && (matches.length === 3)) {
                        this.irc_connection.options.PREFIX = [];
                        for (j = 0; j < matches[2].length; j++) {
                            this.irc_connection.options.PREFIX.push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                        }
                    }
                } else if (option[0] === 'CHANTYPES') {
                    this.irc_connection.options.CHANTYPES = this.irc_connection.options.CHANTYPES.split('');
                } else if (option[0] === 'CHANMODES') {
                    this.irc_connection.options.CHANMODES = option[1].split(',');
                } else if ((option[0] === 'NAMESX') && (!_.contains(this.irc_connection.cap.enabled, 'multi-prefix'))) {
                    this.irc_connection.write('PROTOCTL NAMESX');
                }
            }
        }
        this.irc_connection.emit('server '  + this.irc_connection.irc_host.hostname + ' options', {
            options: this.irc_connection.options,
            cap: this.irc_connection.cap.enabled
        });
    },

    'RPL_ENDOFWHOIS': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' endofwhois', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_AWAY': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisaway', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISUSER': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisuser', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISSERVER': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisserver', {
            nick: command.params[1],
            irc_server: command.params[2],
            server_info: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISOPERATOR': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisoperator', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISCHANNELS':       function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoischannels', {
            nick: command.params[1],
            chans: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISMODES': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoismodes', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISIDLE': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisidle', {
            nick: command.params[1],
            idle: command.params[2],
            logon: command.params[3] || undefined
        });
    },

    'RPL_WHOISREGNICK': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisregnick', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISHOST': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoishost', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    'RPL_WHOISSECURE': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoissecure', {
            nick: command.params[1]
        });
    },

    'RPL_WHOISACCOUNT': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whoisaccount', {
            nick: command.params[1],
            account: command.params[2]
        });
    },

    'RPL_WHOWASUSER': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' whowas', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            real_name: command.params[command.params.length - 1]
        });
    },

    'RPL_ENDOFWHOWAS': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' endofwhowas', {
            nick: command.params[1]
        });
    },

    'ERR_WASNOSUCHNICK': function (command) {
        this.irc_connection.emit('user ' + command.params[1] + ' wasnosucknick', {
            nick: command.params[1]
        });
    },

    'RPL_LISTSTART': function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' list_start', {});
    },

    'RPL_LISTEND': function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' list_end', {});
    },

    'RPL_LIST': function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' list_channel', {
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[command.params.length - 1]
        });
    },

    'RPL_CHANNELMODEIS': function (command) {
        var channel = command.params[1],
            modes = parseModeList.call(this, command.params[2], command.params.slice(3));

        this.irc_connection.emit('channel ' + channel + ' info', {
            channel: channel,
            modes: modes
        });
    },

    'RPL_CREATIONTIME': function (command) {
        var channel = command.params[1];

        this.irc_connection.emit('channel ' + channel + ' info', {
            channel: channel,
            created_at: parseInt(command.params[2], 10)
        });
    },

    'RPL_CHANNEL_URL': function (command) {
        var channel = command.params[1];

        this.irc_connection.emit('channel ' + channel + ' info', {
            channel: channel,
            url: command.params[command.params.length - 1]
        });
    },

    'RPL_MOTD': function (command) {
        this.irc_connection.emit('server '  + this.irc_connection.irc_host.hostname + ' motd', {
            motd: command.params[command.params.length - 1] + '\n'
        });
    },

    'RPL_MOTDSTART': function (command) {
        this.irc_connection.emit('server '  + this.irc_connection.irc_host.hostname + ' motd_start', {});
    },

    'RPL_ENDOFMOTD': function (command) {
        this.irc_connection.emit('server '  + this.irc_connection.irc_host.hostname + ' motd_end', {});
    },

    'RPL_NAMEREPLY': function (command) {
        var members = command.params[command.params.length - 1].split(' ');
        var member_list = [];
        var that = this;
        _.each(members, function (member) {
            var i = 0,
                j = 0,
                modes = [];

            // Make sure we have some prefixes already
            if (that.irc_connection.options.PREFIX) {
                for (j = 0; j < that.irc_connection.options.PREFIX.length; j++) {
                    if (member.charAt(i) === that.irc_connection.options.PREFIX[j].symbol) {
                        modes.push(that.irc_connection.options.PREFIX[j].mode);
                        i++;
                    }
                }
            }

            member_list.push({nick: member, modes: modes});
        });

        this.irc_connection.emit('channel ' + command.params[2] + ' userlist', {
            users: member_list,
            channel: command.params[2]
        });
    },

    'RPL_ENDOFNAMES': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' userlist_end', {
            channel: command.params[1]
        });
    },

    'RPL_WHOREPLY': function (command) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_WHOREPLY
    },

    'RPL_ENDOFWHO': function (command) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_ENDOFWHO
    },

    'RPL_BANLIST': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' banlist', {
            channel: command.params[1],
            banned: command.params[2],
            banned_by: command.params[3],
            banned_at: command.params[4]
        });
    },

    'RPL_ENDOFBANLIST': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' banlist_end', {
            channel: command.params[1]
        });
    },

    'RPL_TOPIC': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' topic', {
            channel: command.params[1],
            topic: command.params[command.params.length - 1]
        });
    },

    'RPL_NOTOPIC': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' topic', {
            channel: command.params[1],
            topic: ''
        });
    },

    'RPL_TOPICWHOTIME': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' topicsetby', {
            nick: command.params[2],
            channel: command.params[1],
            when: command.params[3]
        });
    },

    'RPL_INVITING': function (command) {
        this.irc_connection.emit('channel ' + command.params[1] + ' invited', {
            nick: command.params[0],
            channel: command.params[1]
        });
    },

    'PING': function (command) {
        this.irc_connection.write('PONG ' + command.params[command.params.length - 1]);
    },

    'JOIN': function (command) {
        var channel, time;
        if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        this.irc_connection.emit('channel ' + channel + ' join', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: channel,
            time: time
        });
    },

    'PART': function (command) {
        var time, channel, message;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        channel = command.params[0];
        if (command.params.length > 1) {
            message = command.params[command.params.length - 1];
        }

        this.irc_connection.emit('channel ' + channel + ' part', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: channel,
            message: message,
            time: time
        });
    },

    'KICK': function (command) {
        var time;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        this.irc_connection.emit('channel ' + command.params[0] + ' kick', {
            kicked: command.params[1],
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1],
            time: time
        });
    },

    'QUIT': function (command) {
        var time;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        this.irc_connection.emit('user ' + command.nick + ' quit', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1],
            time: time
        });
    },

    'NOTICE': function (command) {
        var namespace,
            time,
            msg;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP response
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ? 'user' : 'channel';
            this.irc_connection.emit(namespace + ' ' + command.params[0] + ' ctcp_response', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                channel: command.params[0],
                msg: msg.substring(1, msg.length - 1),
                time: time
            });
        } else {
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase() || command.params[0] === '*') ?
                'user' :
                'channel';

            this.irc_connection.emit(namespace + ' ' + command.params[0] + ' notice', {
                from_server: command.prefix ? true : false,
                nick: command.nick || command.prefix || undefined,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg,
                time: time
            });
        }
    },

    'NICK': function (command) {
        var time;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        this.irc_connection.emit('user ' + command.nick + ' nick', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            newnick: command.params[0],
            time: time
        });
    },

    'TOPIC': function (command) {
        var time;

        // If we don't have an associated channel, no need to continue
        if (!command.params[0]) {
            return;
        }

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        var channel = command.params[0],
            topic = command.params[command.params.length - 1] || '';

        this.irc_connection.emit('channel ' + channel + ' topic', {
            nick: command.nick,
            channel: channel,
            topic: topic,
            time: time
        });
    },

    'MODE': function (command) {
        var modes = [], event, time;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        // Get a JSON representation of the modes
        modes = parseModeList.call(this, command.params[1], command.params.slice(2));
        event = (_.contains(this.irc_connection.options.CHANTYPES, command.params[0][0]) ? 'channel ' : 'user ') + command.params[0] + ' mode';

        this.irc_connection.emit(event, {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time
        });
    },

    'PRIVMSG': function (command) {
        var tmp, namespace, time, msg;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            //CTCP request
            if (msg.substr(1, 6) === 'ACTION') {
                this.irc_connection.clientEvent('action', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    channel: command.params[0],
                    msg: msg.substring(8, msg.length - 1),
                    time: time
                });
            } else if (msg.substr(1, 4) === 'KIWI') {
                tmp = msg.substring(6, msg.length - 1);
                namespace = tmp.split(' ', 1)[0];
                this.irc_connection.clientEvent('kiwi', {
                    namespace: namespace,
                    data: tmp.substr(namespace.length + 1),
                    time: time
                });
            } else if (msg.substr(1, 7) === 'VERSION') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'VERSION KiwiIRC' + String.fromCharCode(1));
            } else if (msg.substr(1, 6) === 'SOURCE') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'SOURCE http://www.kiwiirc.com/' + String.fromCharCode(1));
            } else if (msg.substr(1, 10) === 'CLIENTINFO') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'CLIENTINFO SOURCE VERSION TIME' + String.fromCharCode(1));
            } else {
                namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ? 'user' : 'channel';
                this.irc_connection.emit(namespace + ' ' + command.nick + ' ctcp_request', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    type: (msg.substring(1, msg.length - 1).split(' ') || [null])[0],
                    msg: msg.substring(1, msg.length - 1),
                    time: time
                });
            }
        } else {
            // A message to a user (private message) or to a channel?
            namespace = (command.params[0].toLowerCase() === this.irc_connection.nick.toLowerCase()) ? 'user ' + command.nick : 'channel ' + command.params[0];
            this.irc_connection.emit(namespace + ' privmsg', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                channel: command.params[0],
                msg: msg,
                time: time
            });
        }
    },

    'CAP': function (command) {
        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        var capabilities = command.params[command.params.length - 1].replace(/(?:^| )[\-~=]/, '').split(' ');
        var request;

        // Which capabilities we want to enable
        var want = ['multi-prefix', 'away-notify', 'server-time', 'znc.in/server-time-iso', 'znc.in/server-time'];

        if (this.irc_connection.password) {
            want.push('sasl');
        }

        switch (command.params[1]) {
            case 'LS':
                // Compute which of the available capabilities we want and request them
                request = _.intersection(capabilities, want);
                if (request.length > 0) {
                    this.irc_connection.cap.requested = request;
                    this.irc_connection.write('CAP REQ :' + request.join(' '));
                } else {
                    this.irc_connection.write('CAP END');
                    this.irc_connection.cap_negotiation = false;
                }
                break;
            case 'ACK':
                if (capabilities.length > 0) {
                    // Update list of enabled capabilities
                    this.irc_connection.cap.enabled = capabilities;
                    // Update list of capabilities we would like to have but that aren't enabled
                    this.irc_connection.cap.requested = _.difference(this.irc_connection.cap.requested, capabilities);
                }
                if (this.irc_connection.cap.enabled.length > 0) {
                    if (_.contains(this.irc_connection.cap.enabled, 'sasl')) {
                        this.irc_connection.sasl = true;
                        this.irc_connection.write('AUTHENTICATE PLAIN');
                    } else {
                        this.irc_connection.write('CAP END');
                        this.irc_connection.cap_negotiation = false;
                    }
                }
                break;
            case 'NAK':
                if (capabilities.length > 0) {
                    this.irc_connection.cap.requested = _.difference(this.irc_connection.cap.requested, capabilities);
                }
                if (this.irc_connection.cap.requested.length > 0) {
                    this.irc_connection.write('CAP END');
                    this.irc_connection.cap_negotiation = false;
                }
                break;
            case 'LIST':
                // should we do anything here?
                break;
        }
    },

    'AUTHENTICATE': function (command) {
        var b = new Buffer(this.irc_connection.nick + "\0" + this.irc_connection.nick + "\0" + this.irc_connection.password, 'utf8');
        var b64 = b.toString('base64');
        if (command.params[0] === '+') {
            while (b64.length >= 400) {
                this.irc_connection.write('AUTHENTICATE ' + b64.slice(0, 399));
                b64 = b64.slice(399);
            }
            if (b64.length > 0) {
                this.irc_connection.write('AUTHENTICATE ' + b64);
            } else {
                this.irc_connection.write('AUTHENTICATE +');
            }
        } else {
            this.irc_connection.write('CAP END');
            this.irc_connection.cap_negotiation = false;
        }
    },

    'AWAY': function (command) {
        var time;

        // Check if we have a server-time
        time = getServerTime.call(this, command);

        this.irc_connection.emit('user ' + command.nick + ' away', {
            nick: command.nick,
            msg: command.params[command.params.length - 1],
            time: time
        });
    },

    'RPL_SASLAUTHENTICATED': function (command) {
        this.irc_connection.write('CAP END');
        this.irc_connection.cap_negotiation = false;
        this.irc_connection.sasl = true;
    },

    'RPL_SASLLOGGEDIN': function (command) {
        if (this.irc_connection.cap_negotiation === true) {
            this.irc_connection.write('CAP END');
            this.irc_connection.cap_negotiation = false;
        }
    },

    'ERR_SASLNOTAUTHORISED': function (command) {
        this.irc_connection.write('CAP END');
        this.irc_connection.cap_negotiation = false;
    },

    'ERR_SASLABORTED': function (command) {
        this.irc_connection.write('CAP END');
        this.irc_connection.cap_negotiation = false;
    },

    'ERR_SASLALREADYAUTHED': function (command) {
        // noop
    },

    'ERROR': function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' error', {
            reason: command.params[command.params.length - 1]
        });
    },
    ERR_PASSWDMISMATCH: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' password_mismatch', {});
    },

    ERR_LINKCHANNEL: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' channel_redirect', {
            from: command.params[1],
            to: command.params[2]
        });
    },

    ERR_NOSUCHNICK: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' no_such_nick', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CANNOTSENDTOCHAN: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' cannot_send_to_chan', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_TOOMANYCHANNELS: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' too_many_channels', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERNOTINCHANNEL: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' user_not_in_channel', {
            nick: command.params[0],
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NOTONCHANNEL: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' not_on_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERONCHANNEL: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' user_on_channel', {
            nick: command.params[1],
            channel: command.params[2]
        });
    },

    ERR_CHANNELISFULL: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' channel_is_full', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_INVITEONLYCHAN: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' invite_only_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BANNEDFROMCHAN: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' banned_from_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BADCHANNELKEY: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' bad_channel_key', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CHANOPRIVSNEEDED: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' chanop_privs_needed', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NICKNAMEINUSE: function (command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' nickname_in_use', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_ERRONEUSNICKNAME: function(command) {
        this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' erroneus_nickname', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NOTREGISTERED: function (command) {
    },

    RPL_MAPMORE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_MAPEND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LINKS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ENDOFLINKS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_UNKNOWNCOMMAND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, '`' + params.slice(0, -1).join(', ') + '` ' + command.params[command.params.length - 1]);
    },

    ERR_NOMOTD: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, command.params[command.params.length - 1]);
    },

    ERR_NOPRIVILEGES: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, command.params[command.params.length - 1]);
    },

    RPL_STATSCONN: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERCLIENT: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSEROP: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERUNKNOWN: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERCHANNELS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERME: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LOCALUSERS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_GLOBALUSERS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        genericNotice.call(this, command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    }
};




function genericNotice (command, msg, is_error) {
    // Default to being an error
    if (typeof is_error !== 'boolean')
        is_error = true;

    this.irc_connection.clientEvent('notice', {
        from_server: true,
        nick: command.prefix,
        ident: '',
        hostname: '',
        target: command.params[0],
        msg: msg,
        numeric: parseInt(command.command, 10)
    });
}


/**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
function parseModeList(mode_string, mode_params) {
    var chanmodes = this.irc_connection.options.CHANMODES || [],
        prefixes = this.irc_connection.options.PREFIX || [],
        always_param = (chanmodes[0] || '').concat((chanmodes[1] || '')),
        modes = [],
        has_param, i, j, add;

    prefixes = _.reduce(prefixes, function (list, prefix) {
        list.push(prefix.mode);
        return list;
    }, []);
    always_param = always_param.split('').concat(prefixes);

    has_param = function (mode, add) {
        if (_.find(always_param, function (m) {
            return m === mode;
        })) {
            return true;
        } else if (add && _.find((chanmodes[2] || '').split(''), function (m) {
            return m === mode;
        })) {
            return true;
        } else {
            return false;
        }
    };

    j = 0;
    for (i = 0; i < mode_string.length; i++) {
        switch (mode_string[i]) {
            case '+':
                add = true;
                break;
            case '-':
                add = false;
                break;
            default:
                if (has_param(mode_string[i], add)) {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: mode_params[j]});
                    j++;
                } else {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: null});
                }
        }
    }

    return modes;
}


function getServerTime(command) {
    var time;

    // No tags? No times.
    if (!command.tags || command.tags.length === 0) {
        return time;
    }

    if (capContainsAny.call(this, ['server-time', 'znc.in/server-time', 'znc.in/server-time-iso'])) {
        time = _.find(command.tags, function (tag) {
            return tag.tag === 'time';
        });

        time = time ? time.value : undefined;

        // Convert the time value to a unixtimestamp
        if (typeof time === 'string') {
            if (time.indexOf('T') > -1) {
                time = parseISO8601(time);

            } else if(time.match(/^[0-9.]+$/)) {
                // A string formatted unix timestamp
                time = new Date(time * 1000);
            }

            time = time.getTime();

        } else if (typeof time === 'number') {
            time = new Date(time * 1000);
            time = time.getTime();
        }
    }

    return time;
}


function capContainsAny (caps) {
    var intersection;
    if (!caps instanceof Array) {
        caps = [caps];
    }
    intersection = _.intersection(this.irc_connection.cap.enabled, caps);
    return intersection.length > 0;
}


// Code based on http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/#comment-154
function parseISO8601(str) {
    if (Date.prototype.toISOString) {
        return new Date(str);
    } else {
        var parts = str.split('T'),
            dateParts = parts[0].split('-'),
            timeParts = parts[1].split('Z'),
            timeSubParts = timeParts[0].split(':'),
            timeSecParts = timeSubParts[2].split('.'),
            timeHours = Number(timeSubParts[0]),
            _date = new Date();

        _date.setUTCFullYear(Number(dateParts[0]));
        _date.setUTCDate(1);
        _date.setUTCMonth(Number(dateParts[1])-1);
        _date.setUTCDate(Number(dateParts[2]));
        _date.setUTCHours(Number(timeHours));
        _date.setUTCMinutes(Number(timeSubParts[1]));
        _date.setUTCSeconds(Number(timeSecParts[0]));
        if (timeSecParts[1]) {
            _date.setUTCMilliseconds(Number(timeSecParts[1]));
        }

        return _date;
    }
}

var _ = require('lodash');

var irc_numerics = {
    RPL_WELCOME:            '001',
    RPL_MYINFO:             '004',
    RPL_ISUPPORT:           '005',
    RPL_WHOISREGNICK:       '307',
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
    RPL_STARTTLS:           '670',
    RPL_SASLAUTHENTICATED:  '900',
    RPL_SASLLOGGEDIN:       '903',
    ERR_SASLNOTAUTHORISED:  '904',
    ERR_SASLABORTED:        '906',
    ERR_SASLALREADYAUTHED:  '907'
    
};


var IrcCommands = function (irc_connection, con_num, client) {
    this.irc_connection = irc_connection;
    this.con_num = con_num;
    this.client = client;
};
module.exports = IrcCommands;

IrcCommands.prototype.bindEvents = function () {
    var that = this;

    _.each(listeners, function (listener, command) {
        var s = command.substr(0, 4);
        if ((s === 'RPL_') || (s === 'ERR_')) {
            command = irc_numerics[command];
        }
        that.irc_connection.on('irc_' + command, function () {
            listener.apply(that, arguments);
        });
    });
};

IrcCommands.prototype.dispose = function () {
    this.removeAllListeners();
};



var listeners = {
    'RPL_WELCOME': function (command) {
        var nick =  command.params[0];
        this.irc_connection.registered = true;
        this.cap_negotation = false;
        this.client.sendIrcCommand('connect', {server: this.con_num, nick: nick});
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
        this.client.sendIrcCommand('options', {server: this.con_num, options: this.irc_connection.options, cap: this.irc_connection.cap.enabled});
    },
    'RPL_ENDOFWHOIS': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], msg: command.trailing, end: true});
    },
    'RPL_WHOISUSER': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], ident: command.params[2], host: command.params[3], msg: command.trailing, end: false});
    },
    'RPL_WHOISSERVER': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], irc_server: command.params[2], end: false});
    },
    'RPL_WHOISOPERATOR': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], msg: command.trailing, end: false});
    },
    'RPL_WHOISCHANNELS':       function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], chans: command.trailing, end: false});
    },
    'RPL_WHOISMODES': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], msg: command.trailing, end: false});
    },
    'RPL_WHOISIDLE': function (command) {
        if (command.params[3]) {
            this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], idle: command.params[2], logon: command.params[3], end: false});
        } else {
            this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], idle: command.params[2], end: false});
        }
    },
    'RPL_WHOISREGNICK': function (command) {
        this.client.sendIrcCommand('whois', {server: this.con_num, nick: command.params[1], msg: command.trailing, end: false});
    },
    'RPL_LISTSTART': function (command) {
        this.client.sendIrcCommand('list_start', {server: this.con_num});
        this.client.buffer.list = [];
    },
    'RPL_LISTEND': function (command) {
        if (this.client.buffer.list.length > 0) {
            this.client.buffer.list = _.sortBy(this.client.buffer.list, function (channel) {
                return channel.num_users;
            });
            this.client.sendIrcCommand('list_channel', {server: this.con_num, chans: this.client.buffer.list});
            this.client.buffer.list = [];
        }
        this.client.sendIrcCommand('list_end', {server: this.con_num});
    },
    'RPL_LIST': function (command) {
        this.client.buffer.list.push({server: this.con_num, channel: command.params[1], num_users: parseInt(command.params[2], 10), topic: command.trailing});
        if (this.client.buffer.list.length > 200){
            this.client.buffer.list = _.sortBy(this.client.buffer.list, function (channel) {
                return channel.num_users;
            });
            this.client.sendIrcCommand('list_channel', {server: this.con_num, chans: this.client.buffer.list});
            this.client.buffer.list = [];
        }
    },
    'RPL_MOTD': function (command) {
        this.client.buffer.motd += command.trailing + '\n';
    },
    'RPL_MOTDSTART': function (command) {
        this.client.buffer.motd = '';
    },
    'RPL_ENDOFMOTD': function (command) {
        this.client.sendIrcCommand('motd', {server: this.con_num, msg: this.client.buffer.motd});
    },
    'RPL_NAMEREPLY': function (command) {
        var members = command.trailing.split(' ');
        var member_list = [];
        var that = this;
        var i = 0;
        _.each(members, function (member) {
            var j, k, modes = [];
            for (j = 0; j < member.length; j++) {
                for (k = 0; k < that.irc_connection.options.PREFIX.length; k++) {
                    if (member.charAt(j) === that.irc_connection.options.PREFIX[k].symbol) {
                        modes.push(that.irc_connection.options.PREFIX[k].mode);
                        i++;
                    }
                }
            }
            member_list.push({nick: member, modes: modes});
            if (i++ >= 50) {
                that.client.sendIrcCommand('userlist', {server: that.con_num, users: member_list, channel: command.params[2]});
                member_list = [];
                i = 0;
            }
        });
        if (i > 0) {
            this.client.sendIrcCommand('userlist', {server: this.con_num, users: member_list, channel: command.params[2]});
        }
    },
    'RPL_ENDOFNAMES': function (command) {
        this.client.sendIrcCommand('userlist_end', {server: this.con_num, channel: command.params[1]});
    },
    'RPL_BANLIST': function (command) {
        this.client.sendIrcCommand('banlist', {server: this.con_num, channel: command.params[1], banned: command.params[2], banned_by: command.params[3], banned_at: command.params[4]});
    },
    'RPL_ENDOFBANLIST': function (command) {
        this.client.sendIrcCommand('banlist_end', {server: this.con_num, channel: command.params[1]});
    },
    'RPL_TOPIC': function (command) {
        this.client.sendIrcCommand('topic', {server: this.con_num, nick: '', channel: command.params[1], topic: command.trailing});
    },
    'RPL_NOTOPIC': function (command) {
        this.client.sendIrcCommand('topic', {server: this.con_num, nick: '', channel: command.params[1], topic: ''});
    },
    'RPL_TOPICWHOTIME': function (command) {
        this.client.sendIrcCommand('topicsetby', {server: this.con_num, nick: command.params[2], channel: command.params[1], when: command.params[3]});
    },
    'PING': function (command) {
        this.irc_connection.write('PONG ' + command.trailing);
    },
    'JOIN': function (command) {
        var channel;
        if (typeof command.trailing === 'string' && command.trailing !== '') {
            channel = command.trailing;
        } else if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }
        
        this.client.sendIrcCommand('join', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: channel});
        
        if (command.nick === this.nick) {
            this.irc_connection.write('NAMES ' + channel);
        }
    },
    'PART': function (command) {
        this.client.sendIrcCommand('part', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], message: command.trailing});
    },
    'KICK': function (command) {
        this.client.sendIrcCommand('kick', {server: this.con_num, kicked: command.params[1], nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], message: command.trailing});
    },
    'QUIT': function (command) {
        this.client.sendIrcCommand('quit', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, message: command.trailing});
    },
    'NOTICE': function (command) {
        if ((command.trailing.charAt(0) === String.fromCharCode(1)) && (command.trailing.charAt(command.trailing.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP response
            this.client.sendIrcCommand('ctcp_response', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing.substr(1, command.trailing.length - 2)});
        } else {
            this.client.sendIrcCommand('notice', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, target: command.params[0], msg: command.trailing});
        }
    },
    'NICK': function (command) {
        this.client.sendIrcCommand('nick', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, newnick: command.trailing || command.params[0]});
    },
    'TOPIC': function (command) {
        this.client.sendIrcCommand('topic', {server: this.con_num, nick: command.nick, channel: command.params[0], topic: command.trailing});
    },
    'MODE': function (command) {                
        var chanmodes = this.irc_connection.options.CHANMODES,
            prefixes = this.irc_connection.options.PREFIX,
            always_param = chanmodes[0].concat(chanmodes[1]),
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
            } else if (add && _.find(chanmodes[2].split(''), function (m) {
                return m === mode;
            })) {
                return true;
            } else {
                return false;
            }
        };
        
        if (!command.params[1]) {
            command.params[1] = command.trailing;
        }
        j = 0;
        for (i = 0; i < command.params[1].length; i++) {
            switch (command.params[1][i]) {
                case '+':
                    add = true;
                    break;
                case '-':
                    add = false;
                    break;
                default:
                    if (has_param(command.params[1][i], add)) {
                        modes.push({mode: (add ? '+' : '-') + command.params[1][i], param: command.params[2 + j]});
                        j++;
                    } else {
                        modes.push({mode: (add ? '+' : '-') + command.params[1][i], param: null});
                    }
            }
        }
        
        this.client.sendIrcCommand('mode', {
            server: this.con_num,
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes
        });
    },
    'PRIVMSG': function (command) {
        var tmp, namespace;
        if ((command.trailing.charAt(0) === String.fromCharCode(1)) && (command.trailing.charAt(command.trailing.length - 1) === String.fromCharCode(1))) {
            //CTCP request
            if (command.trailing.substr(1, 6) === 'ACTION') {
                this.client.sendIrcCommand('action', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing.substr(7, command.trailing.length - 2)});
            } else if (command.trailing.substr(1, 4) === 'KIWI') {
                tmp = command.trailing.substr(6, command.trailing.length - 2);
                namespace = tmp.split(' ', 1)[0];
                this.client.sendIrcCommand('kiwi', {server: this.con_num, namespace: namespace, data: tmp.substr(namespace.length + 1)});
            } else if (command.trailing.substr(1, 7) === 'VERSION') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'VERSION KiwiIRC' + String.fromCharCode(1));
            } else if (command.trailing.substr(1, 6) === 'SOURCE') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'SOURCE http://www.kiwiirc.com/' + String.fromCharCode(1));
            } else if (command.trailing.substr(1, 10) === 'CLIENTINFO') {
                this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'CLIENTINFO SOURCE VERSION TIME' + String.fromCharCode(1));
            } else {
                this.client.sendIrcCommand('ctcp_request', {
                    server: this.con_num,
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    type: (command.trailing.substr(1, command.trailing.length - 2).split(' ') || [null])[0],
                    msg: command.trailing.substr(1, command.trailing.length - 2)
                });
            }
        } else {
            //{nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing}
            this.client.sendIrcCommand('msg', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing});
        }
    },
    'CAP': function (command) {
        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        var capabilities = command.trailing.replace(/[\-~=]/, '').split(' ');
        var request;
        var want = ['multi-prefix', 'away-notify'];
        
        if (this.irc_connection.password) {
            want.push('sasl');
        }
        
        switch (command.params[1]) {
            case 'LS':
                request = _.intersection(capabilities, want);
                if (request.length > 0) {
                    this.irc_connection.cap.requested = request;
                    this.irc_connection.write('CAP REQ :' + request.join(' '));
                } else {
                    this.irc_connection.write('CAP END');
                    this.irc_connection.cap_negotation = false;
                }
                break;
            case 'ACK':
                if (capabilities.length > 0) {
                    this.irc_connection.cap.enabled = capabilities;
                    this.irc_connection.cap.requested = _.difference(this.irc_connection.cap.requested, capabilities);
                }
                if (this.irc_connection.cap.requested.length > 0) {
                    if (_.contains(this.irc_connection.cap.enabled, 'sasl')) {
                        this.irc_connection.sasl = true;
                        this.irc_connection.write('AUTHENTICATE PLAIN');
                    } else {
                        this.irc_connection.write('CAP END');
                        this.irc_connection.cap_negotation = false;
                    }
                }
                break;
            case 'NAK':
                if (capabilities.length > 0) {
                    this.irc_connection.cap.requested = _.difference(this.irc_connection.cap.requested, capabilities);
                }
                if (this.irc_connection.cap.requested.length > 0) {
                    this.irc_connection.write('CAP END');
                    this.irc_connection.cap_negotation = false;
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
            this.irc_connection.cap_negotation = false;
        }
    },
    'AWAY': function (command) {
        this.client.sendIrcCommand('away', {server: this.con_num, nick: command.nick, msg: command.trailing});
    },
    'RPL_SASLAUTHENTICATED': function (command) {
        this.irc_connection.write('CAP END');
        this.irc_connection.cap_negotation = false;
        this.irc_connection.sasl = true;
    },
    'RPL_SASLLOGGEDIN': function (command) {
        if (this.irc_connection.cap_negotation === false) {
            this.irc_connection.write('CAP END');
        }
    },
    'ERR_SASLNOTAUTHORISED': function (command) {
            this.irc_connection.write('CAP END');
            this.irc_connection.cap_negotation = false;
        },
    'ERR_SASLABORTED': function (command) {
        this.irc_connection.write('CAP END');
        this.irc_connection.cap_negotation = false;
    },
    'ERR_SASLALREADYAUTHED': function (command) {
        // noop
    },
    'ERROR': function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'error', reason: command.trailing});
    },
    ERR_LINKCHANNEL: function (command) {
        this.client.sendIrcCommand('channel_redirect', {server: this.con_num, from: command.params[1], to: command.params[2]});
    },
    ERR_NOSUCHNICK: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'no_such_nick', nick: command.params[1], reason: command.trailing});
    },
    ERR_CANNOTSENDTOCHAN: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'cannot_send_to_chan', channel: command.params[1], reason: command.trailing});
    },
    ERR_TOOMANYCHANNELS: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'too_many_channels', channel: command.params[1], reason: command.trailing});
    },
    ERR_USERNOTINCHANNEL: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'user_not_in_channel', nick: command.params[0], channel: command.params[1], reason: command.trailing});
    },
    ERR_NOTONCHANNEL: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'not_on_channel', channel: command.params[1], reason: command.trailing});
    },
    ERR_CHANNELISFULL: function (command) {
            this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'channel_is_full', channel: command.params[1], reason: command.trailing});
        },
    ERR_INVITEONLYCHAN: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'invite_only_channel', channel: command.params[1], reason: command.trailing});
    },
    ERR_BANNEDFROMCHAN: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'banned_from_channel', channel: command.params[1], reason: command.trailing});
    },
    ERR_BADCHANNELKEY: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'bad_channel_key', channel: command.params[1], reason: command.trailing});
    },
    ERR_CHANOPRIVSNEEDED: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'chanop_privs_needed', channel: command.params[1], reason: command.trailing});
    },
    ERR_NICKNAMEINUSE: function (command) {
        this.client.sendIrcCommand('irc_error', {server: this.con_num, error: 'nickname_in_use', nick: command.params[1], reason: command.trailing});
    },
    ERR_NOTREGISTERED: function (command) {
    }
};

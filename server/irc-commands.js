var _ = require('underscore');

var irc_numerics = {
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


var Binder = function (irc_connection, con_num, client) {
    this.irc_connection = irc_connection;
    this.con_num = con_num;
    this.client = client;
};
module.exports.Binder = Binder;

Binder.prototype.bind_irc_commands = function () {
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

var listeners = {
    'RPL_WELCOME':            function (command) {
                var nick =  command.params[0];
                this.irc_connection.registered = true;
                this.client.sendIRCCommand('connect', {server: this.con_num, nick: nick});
            },
    'RPL_ISUPPORT':           function (command) {
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
                        } else if (option[0] === 'NAMESX') {
                            this.irc_connection.write('PROTOCTL NAMESX');
                        }
                    }
                }
                //this.client.sendIRCCommand({server: this.con_num, command: 'RPL_ISUPPORT', options: this.irc_connection.options});
                //websocket.sendClientEvent('options', {server: '', "options": irc_connection.IRC.options});
                this.client.sendIRCCommand('options', {server: this.con_num, options: this.irc_connection.options});
            },
    'RPL_ENDOFWHOIS':         function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_ENDOFWHOIS';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: true});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: true});
            },
    'RPL_WHOISUSER':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISUSER';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_WHOISSERVER':        function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISSERVER';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_WHOISOPERATOR':      function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISOPERATOR';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_WHOISCHANNELS':      function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISCHANNELS';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_WHOISMODES':         function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISMODES';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_WHOISIDLE':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_WHOISIDLE';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('whois', {server: '', nick: msg.params.split(" ", 3)[1], "msg": msg.trailing, end: false});
                this.client.sendIRCCommand('whois', {server: this.con_num, nick: command.params[0], msg: command.trailing, end: false});
            },
    'RPL_LISTSTART':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_LISTSTART';
				this.client.sendIRCCommand(command);*/
                this.client.sendIRCCommand('list_start', {server: this.con_num});
                this.client.buffer.list = [];
            },
    'RPL_LISTEND':            function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_LISTEND';
				this.client.sendIRCCommand(command);*/
                if (this.client.buffer.list.length > 0) {
                    this.client.buffer.list = _.sortBy(this.client.buffer.list, function (channel) {
                        return channel.num_users;
                    });
                    this.client.sendIRCCommand('list_channel', {server: this.con_num, chans: this.client.buffer.list});
                    this.client.buffer.list = [];
                }
                this.client.sendIRCCommand('list_end', {server: this.con_num});
            },
    'RPL_LIST':               function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_LIST';
				this.client.sendIRCCommand(command);*/
                this.client.buffer.list.push({server: this.con_num, channel: command.params[1], num_users: parseInt(command.params[2]), topic: command.trailing});
                if (this.client.buffer.list.length > 200){
                    this.client.buffer.list = _.sortBy(this.client.buffer.list, function (channel) {
                        return channel.num_users;
                    });
                    this.client.sendIRCCommand('list_channel', {server: this.con_num, chans: this.client.buffer.list});
                    this.client.buffer.list = [];
                }
            },
    'RPL_MOTD':               function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_MOTD';
				this.client.sendIRCCommand(command);*/
                this.client.buffer.motd += command.trailing + '\n';
            },
    'RPL_MOTDSTART':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_MOTDSTART';
				this.client.sendIRCCommand(command);*/
                this.client.buffer.motd = '';
            },
    'RPL_ENDOFMOTD':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_ENDOFMOTD';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('motd', {server: '', 'msg': websocket.kiwi.buffer.motd});
                this.client.sendIRCCommand('motd', {server: this.con_num, msg: this.client.buffer.motd});
            },
    'RPL_NAMEREPLY':          function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_NAMEREPLY';
				this.client.sendIRCCommand(command);*/
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
                        that.client.sendIRCCommand('userlist', {server: that.con_num, users: member_list, channel: command.params[2]});
                        member_list = [];
                        i = 0;
                    }
                });
                if (i > 0) {
                    this.client.sendIRCCommand('userlist', {server: this.con_num, users: member_list, channel: command.params[2]});
                }
            },
    'RPL_ENDOFNAMES':         function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_ENDOFNAMES';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('userlist_end', {server: '', channel: msg.params.split(" ")[1]});
                this.client.sendIRCCommand('userlist_end', {server: this.con_num, channel: command.params[1]});
            },
    'RPL_BANLIST':            function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_BANLIST';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('banlist', {server: '', channel: params[1], banned: params[2], banned_by: params[3], banned_at: params[4]});
                this.client.sendIRCCommand('banlist', {server: this.con_num, channel: command.params[1], banned: command.params[2], banned_by: command.params[3], banned_at: command.params[4]});
            },
    'RPL_ENDOFBANLIST':       function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_ENDOFBANLIST';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('banlist_end', {server: '', channel: msg.params.split(" ")[1]});
                this.client.sendIRCCommand('banlist_end', {server: this.con_num, channel: command.params[1]});
            },
    'RPL_TOPIC':              function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_TOPIC';
				this.client.sendIRCCommand(command);*/
                //{nick: '', channel: msg.params.split(" ")[1], topic: msg.trailing};
                this.client.sendIRCCommand('topic', {server: this.con_num, nick: '', channel: command.params[1], topic: command.trailing});
            },
    'RPL_NOTOPIC':            function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_NOTOPIC';
				this.client.sendIRCCommand(command);*/
                this.client.sendIRCCommand('topic', {server: this.con_num, nick: '', channel: command.params[1], topic: ''});
            },
    'RPL_TOPICWHOTIME':       function (command) {
				/*command.server = this.con_num;
				command.command = 'RPL_TOPICWHOTIME';
				this.client.sendIRCCommand(command);*/
                //{nick: nick, channel: channel, when: when};
                this.client.sendIRCCommand('topicsetby', {server: this.con_num, nick: command.params[2], channel: command.params[1], when: command.params[3]});
            },
    'PING':                 function (command) {
                this.irc_connection.write('PONG ' + command.trailing);
            },
    'JOIN':                 function (command) {
				var channel;
				if (typeof command.trailing === 'string' && command.trailing !== '') {
					channel = command.trailing;
				} else if (typeof command.params[0] === 'string' && command.params[0] !== '') {
					channel = command.params[0];
				}
				/*command.server = this.con_num;
				command.command = 'JOIN';
				command.params = [channel];
                this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('join', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: channel});
                this.client.sendIRCCommand('join', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: channel});
                
                if (command.nick === this.nick) {
                    this.irc_connection.write('NAMES ' + channel);
                }
            },
    'PART':                 function (command) {
				/*command.server = this.con_num;
				command.command = 'PART';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('part', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), message: msg.trailing});
                this.client.sendIRCCommand('part', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], message: command.trailing});
            },
    'KICK':                 function (command) {
				/*command.server = this.con_num;
				command.command = 'KICK';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('kick', {kicked: params[1], nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: params[0].trim(), message: msg.trailing});
                this.client.sendIRCCommand('kick', {server: this.con_num, kicked: command.params[1], nick: command.nick, ident: command.ident, hostname: command.hostname, channel: params[0], message: command.trailing});
            },
    'QUIT':                 function (command) {
				/*command.server = this.con_num;
				command.command = 'QUIT';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('quit', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, message: msg.trailing});
                this.client.sendIRCCommand('quit', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, message: command.trailing});
            },
    'NOTICE':               function (command) {
				/*command.server = this.con_num;
				command.command = 'NOTICE';
				this.client.sendIRCCommand(command);*/
                if ((command.trailing.charAt(0) === String.fromCharCode(1)) && (command.trailing.charAt(command.trailing.length - 1) === String.fromCharCode(1))) {
                    // It's a CTCP response
                    //websocket.sendClientEvent('ctcp_response', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing.substr(1, msg.trailing.length - 2)});
                    this.client.sendIRCCommand('ctcp_response', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing.substr(1, command.trailing.length - 2)});
                } else {
                    //websocket.sendClientEvent('notice', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, target: msg.params.trim(), msg: msg.trailing});
                    this.client.sendIRCCommand('notice', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, target: command.params[0], msg: command.trailing});
                }
            },
    'NICK':                 function (command) {
				/*command.server = this.con_num;
				command.command = 'NICK';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('nick', {nick: msg.nick, ident: msg.ident, hostname: msg.hostname, newnick: msg.trailing});
                this.client.sendIRCCommand('nick', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, newnick: command.params[0]});
            },
    'TOPIC':                function (command) {
				/*command.server = this.con_num;
				command.command = 'TOPIC';
				this.client.sendIRCCommand(command);*/
                //{nick: msg.nick, channel: msg.params, topic: msg.trailing};
                this.client.sendIRCCommand('topic', {server: this.con_num, nick: command.nick, channel: msg.params[0], topic: command.trailing});
            },
    'MODE':                 function (command) {
				/*command.server = this.con_num;
				command.command = 'MODE';
				this.client.sendIRCCommand(command);*/
                var ret = { server: this.con_num, nick: command.nick }
                switch (command.params.length) {
                    case 1:
                        ret.affected_nick = command.params[0];
                        ret.mode = command.trailing;
                        break;
                    case 2:
                        ret.channel = command.params[0];
                        ret.mode = command.params[1];
                        break;
                    default:
                        ret.channel = command.params[0];
                        ret.mode = command.params[1];
                        ret.affected_nick = command.params[2];
                        break;
                }
                this.client.sendIRCCommand('mode', ret);
            },
    'PRIVMSG':              function (command) {
				/*command.server = this.con_num;
				command.command = 'PRIVMSG';
				this.client.sendIRCCommand(command);*/
                var tmp, namespace;
                if ((command.trailing.charAt(0) === String.fromCharCode(1)) && (command.trailing.charAt(command.trailing.length - 1) === String.fromCharCode(1))) {
                    //CTCP request
                    if (command.trailing.substr(1, 6) === 'ACTION') {
                        this.client.sendIRCCommand('action', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing.substr(7, command.trailing.length - 2)});
                    } else if (command.trailing.substr(1, 4) === 'KIWI') {
                        tmp = msg.trailing.substr(6, msg.trailing.length - 2);
                        namespace = tmp.split(' ', 1)[0];
                        this.client.sendIRCCommand('kiwi', {server: this.con_num, namespace: namespace, data: tmp.substr(namespace.length + 1)});
                    } else if (msg.trailing.substr(1, 7) === 'VERSION') {
                        this.irc_connection.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'VERSION KiwiIRC' + String.fromCharCode(1));
                    } else {
                        this.client.sendIRCCommand('ctcp_request', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing.substr(1, command.trailing.length - 2)});
                    }
                } else {
                    //{nick: msg.nick, ident: msg.ident, hostname: msg.hostname, channel: msg.params.trim(), msg: msg.trailing}
                    this.client.sendIRCCommand('msg', {server: this.con_num, nick: command.nick, ident: command.ident, hostname: command.hostname, channel: command.params[0], msg: command.trailing});
                }
            },
    'ERROR':                function (command) {
				/*command.server = this.con_num;
				command.command = 'ERROR';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'error', reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'error', reason: command.trailing});
            },
    ERR_LINKCHANNEL:        function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_LINKCHANNEL';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('channel_redirect', {from: params[1], to: params[2]});
                this.client.sendIRCCommand('channel_redirect', {server: this.con_num, from: command.params[1], to: command.params[2]});
            },
    ERR_NOSUCHNICK:         function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_NOSUCHNICK';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'no_such_nick', nick: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'no_such_nick', nick: command.params[1], reason: command.trailing});
            },
    ERR_CANNOTSENDTOCHAN:   function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_CANNOTSENDTOCHAN';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'cannot_send_to_chan', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'cannot_send_to_chan', channel: command.params[1], reason: command.trailing});
            },
    ERR_TOOMANYCHANNELS:    function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_TOOMANYCHANNELS';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'too_many_channels', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'too_many_channels', channel: command.params[1], reason: command.trailing});
            },
    ERR_USERNOTINCHANNEL:   function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_USERNOTINCHANNEL';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'user_not_in_channel', nick: params[0], channel: params[1], reason: msg.trainling});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'user_not_in_channel', nick: command.params[0], channel: command.params[1], reason: command.trailing});
            },
    ERR_NOTONCHANNEL:       function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_NOTONCHANNEL';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'not_on_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'not_on_channel', channel: command.params[1], reason: command.trailing});
            },
    ERR_CHANNELISFULL:      function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_CHANNELISFULL';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'channel_is_full', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'channel_is_full', channel: command.params[1], reason: command.trailing});
            },
    ERR_INVITEONLYCHAN:     function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_INVITEONLYCHAN';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'invite_only_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'invite_only_channel', channel: command.params[1], reason: command.trailing});
            },
    ERR_BANNEDFROMCHAN:     function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_BANNEDFROMCHAN';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'banned_from_channel', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'banned_from_channel', channel: command.params[1], reason: command.trailing});
            },
    ERR_BADCHANNELKEY:      function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_BADCHANNELKEY';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'bad_channel_key', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'bad_channel_key', channel: command.params[1], reason: command.trailing});
            },
    ERR_CHANOPRIVSNEEDED:   function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_CHANOPRIVSNEEDED';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'chanop_privs_needed', channel: msg.params.split(" ")[1], reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'chanop_privs_needed', channel: command.params[1], reason: command.trailing});
            },
    ERR_NICKNAMEINUSE:      function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_NICKNAMEINUSE';
				this.client.sendIRCCommand(command);*/
                //websocket.sendClientEvent('irc_error', {error: 'nickname_in_use', nick: _.last(msg.params.split(" ")), reason: msg.trailing});
                this.client.sendIRCCommand('irc_error', {server: this.con_num, error: 'nickname_in_use', nick: command.params[1], reason: command.trailing});
            },
    ERR_NOTREGISTERED:      function (command) {
				/*command.server = this.con_num;
				command.command = 'ERR_NOTREGISTERED';
				this.client.sendIRCCommand(command);*/
            }
};

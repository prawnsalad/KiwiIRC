var _ = require('lodash');

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};


var handlers = {
    RPL_LISTSTART: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' list_start', {});
    },

    RPL_LISTEND: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' list_end', {});
    },

    RPL_LIST: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' list_channel', {
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[3] || ''
        });
    },



    RPL_MOTD: function (command) {
        this.emit('server '  + this.irc_connection.irc_host.hostname + ' motd', {
            motd: command.params[command.params.length - 1] + '\n'
        });
    },

    RPL_MOTDSTART: function (command) {
        this.emit('server '  + this.irc_connection.irc_host.hostname + ' motd_start', {});
    },

    RPL_ENDOFMOTD: function (command) {
        this.emit('server '  + this.irc_connection.irc_host.hostname + ' motd_end', {});
    },



    RPL_WHOREPLY: function (command) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_WHOREPLY
    },

    RPL_ENDOFWHO: function (command) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_ENDOFWHO
    },


    PING: function (command) {
        this.irc_connection.write('PONG ' + command.params[command.params.length - 1]);
    },


    MODE: function (command) {
        var modes = [], event, time;

        // Check if we have a server-time
        time = command.getServerTime();

        // Get a JSON representation of the modes
        modes = this.parseModeList(command.params[1], command.params.slice(2));
        event = (_.contains(this.irc_connection.options.CHANTYPES, command.params[0][0]) ? 'channel ' : 'user ') + command.params[0] + ' mode';

        this.emit(event, {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time
        });
    },


    ERROR: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' error', {
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_PASSWDMISMATCH: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' password_mismatch', {});
    },

    ERR_LINKCHANNEL: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' channel_redirect', {
            from: command.params[1],
            to: command.params[2]
        });
    },

    ERR_NOSUCHNICK: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' no_such_nick', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CANNOTSENDTOCHAN: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' cannot_send_to_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_TOOMANYCHANNELS: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' too_many_channels', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERNOTINCHANNEL: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' user_not_in_channel', {
            nick: command.params[0],
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NOTONCHANNEL: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' not_on_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERONCHANNEL: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' user_on_channel', {
            nick: command.params[1],
            channel: command.params[2]
        });
    },

    ERR_CHANNELISFULL: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' channel_is_full', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_INVITEONLYCHAN: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' invite_only_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BANNEDFROMCHAN: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' banned_from_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BADCHANNELKEY: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' bad_channel_key', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CHANOPRIVSNEEDED: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' chanop_privs_needed', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NICKNAMEINUSE: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' nickname_in_use', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NICKCOLLISION: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' nickname_collision', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BANNICKCHANGE: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' banned_nickname_change', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NICKTOOFAST: function (command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' nick_change_too_fast', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_ERRONEUSNICKNAME: function(command) {
        this.emit('server ' + this.irc_connection.irc_host.hostname + ' erroneus_nickname', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NOTREGISTERED: function (command) {
    },

    RPL_MAPMORE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_MAPEND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LINKS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ENDOFLINKS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_UNKNOWNCOMMAND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, '`' + params.slice(0, -1).join(', ') + '` ' + command.params[command.params.length - 1]);
    },

    ERR_NOMOTD: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, command.params[command.params.length - 1]);
    },

    ERR_NOPRIVILEGES: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, command.params[command.params.length - 1]);
    },

    RPL_STATSCONN: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERCLIENT: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSEROP: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERUNKNOWN: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERCHANNELS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LUSERME: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_LOCALUSERS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_GLOBALUSERS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_HOSTCLOACKING: function (command) {
        this.emitGenericNotice(command, command.params[1] + ' ' + command.params[command.params.length - 1]);
    },

    RPL_YOURHOST: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_CREATED: function (command) {
        this.emit('server '  + this.irc_connection.irc_host.hostname + ' server', {
            motd: command.params[command.params.length - 1] + '\n'
        });
    },

    RPL_MYINFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SNOMASK: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_NOWOPER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACELINK: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACECONNECTING: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACEHANDSHAKE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACEUNKNOWN: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACEOPERATOR: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACEUSER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACESERVER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACESERVICE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACENEWTYPE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACECLASS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_TRACERECONNECT: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSLINKINFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSCOMMANDS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSCLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSNLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSILINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSKLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSPLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSYLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ENDOFSTATS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSBLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_UMODEIS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SQLINE_NICK: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATS_E: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATS_D: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SPAMFILTER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SERVICEINFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ENDOFSERVICES: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SERVICE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SERVLIST: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_SERVLISTEND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSLLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSUPTIME: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSOLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSHLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSSLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSGLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSXLINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSULINE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_STATSDEBUG: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ADMINME: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ADMINLOC1: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ADMINLOC2: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ADMINEMAIL: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_HELPHDR: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_HELPOP: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_HELPTLR: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ZIPSTATS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_WHOISSPECIAL: function (command) {
        this.emit('user ' + command.params[1] + ' whoisswhois', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISACTUALLY: function (command) {
        this.emit('user ' + command.params[1] + ' whoishost', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_INFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_ENDINFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    RPL_NOSUCHSERVER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_NOADMININFO: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_NOTENOUGHPARAMS: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_NOOPERHOST: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_CANTJOINOPERSONLY: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_UNKNOWNMODE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_CANTKILLSERVER: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_ISCHANSERVICE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },

    ERR_ISREALSERVICE: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    },
    ERR_CANNOTDOCOMMAND: function (command) {
        var params = _.clone(command.params);
        params.shift();
        this.emitGenericNotice(command, params.slice(0, -1).join(', ') + ' ' + command.params[command.params.length - 1]);
    }
};
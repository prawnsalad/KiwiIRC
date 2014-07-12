var _ = require('lodash'),
    irc_numerics,
    unknownCommand;

irc_numerics = {
    '001': 'RPL_WELCOME',
    '002': 'RPL_YOURHOST',
    '003': 'RPL_CREATED',
    '004': 'RPL_MYINFO',
    '005': 'RPL_ISUPPORT',
    '006': 'RPL_MAPMORE',
    '007': 'RPL_MAPEND',
    '008': 'RPL_SNOMASK',
    '015': 'RPL_MAP',
    '017': 'RPL_MAPEND',
    '042': 'RPL_YOURID',
    '200': 'RPL_TRACELINK',
    '201': 'RPL_TRACECONNECTING',
    '202': 'RPL_TRACEHANDSHAKE',
    '203': 'RPL_TRACEUNKNOWN',
    '204': 'RPL_TRACEOPERATOR',
    '205': 'RPL_TRACEUSER',
    '206': 'RPL_TRACESERVER',
    '207': 'RPL_TRACESERVICE',
    '208': 'RPL_TRACENEWTYPE',
    '209': 'RPL_TRACECLASS',
    '210': 'RPL_TRACERECONNECT',
    '211': 'RPL_STATSLINKINFO',
    '212': 'RPL_STATSCOMMANDS',
    '213': 'RPL_STATSCLINE',
    '214': 'RPL_STATSNLINE',
    '215': 'RPL_STATSILINE',
    '216': 'RPL_STATSKLINE',
    '217': 'RPL_STATSPLINE',
    '218': 'RPL_STATSYLINE',
    '219': 'RPL_ENDOFSTATS',
    '220': 'RPL_STATSBLINE',
    '221': 'RPL_UMODEIS',
    '222': 'RPL_SQLINE_NICK',
    '223': 'RPL_STATS_E',
    '224': 'RPL_STATS_D',
    '229': 'RPL_SPAMFILTER',
    '231': 'RPL_SERVICEINFO',
    '232': 'RPL_ENDOFSERVICES',
    '233': 'RPL_SERVICE',
    '234': 'RPL_SERVLIST',
    '235': 'RPL_SERVLISTEND',
    '241': 'RPL_STATSLLINE',
    '242': 'RPL_STATSUPTIME',
    '243': 'RPL_STATSOLINE',
    '244': 'RPL_STATSHLINE',
    '245': 'RPL_STATSSLINE',
    '246': 'RPL_STATSGLINE',
    '247': 'RPL_STATSXLINE',
    '248': 'RPL_STATSULINE',
    '249': 'RPL_STATSDEBUG',
    '250': 'RPL_STATSCONN',
    '251': 'RPL_LUSERCLIENT',
    '252': 'RPL_LUSEROP',
    '253': 'RPL_LUSERUNKNOWN',
    '254': 'RPL_LUSERCHANNELS',
    '255': 'RPL_LUSERME',
    '256': 'RPL_ADMINME',
    '257': 'RPL_ADMINLOC1',
    '258': 'RPL_ADMINLOC2',
    '259': 'RPL_ADMINEMAIL',
    '265': 'RPL_LOCALUSERS',
    '266': 'RPL_GLOBALUSERS',
    '290': 'RPL_HELPHDR',
    '291': 'RPL_HELPOP',
    '292': 'RPL_HELPTLR',
    '301': 'RPL_AWAY',
    '304': 'RPL_ZIPSTATS',
    '307': 'RPL_WHOISREGNICK',
    '310': 'RPL_WHOISHELPOP',
    '311': 'RPL_WHOISUSER',
    '312': 'RPL_WHOISSERVER',
    '313': 'RPL_WHOISOPERATOR',
    '314': 'RPL_WHOWASUSER',
    '315': 'RPL_ENDOFWHO',
    '317': 'RPL_WHOISIDLE',
    '318': 'RPL_ENDOFWHOIS',
    '319': 'RPL_WHOISCHANNELS',
    '320': 'RPL_WHOISSPECIAL',
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
    '335': 'RPL_WHOISBOT',
    '338': 'RPL_WHOISACTUALLY',
    '341': 'RPL_INVITING',
    '352': 'RPL_WHOREPLY',
    '353': 'RPL_NAMEREPLY',
    '364': 'RPL_LINKS',
    '365': 'RPL_ENDOFLINKS',
    '366': 'RPL_ENDOFNAMES',
    '367': 'RPL_BANLIST',
    '368': 'RPL_ENDOFBANLIST',
    '369': 'RPL_ENDOFWHOWAS',
    '371': 'RPL_INFO',
    '372': 'RPL_MOTD',
    '374': 'RPL_ENDINFO',
    '375': 'RPL_MOTDSTART',
    '376': 'RPL_ENDOFMOTD',
    '378': 'RPL_WHOISHOST',
    '379': 'RPL_WHOISMODES',
    '381': 'RPL_NOWOPER',
    '396': 'RPL_HOSTCLOACKING',
    '401': 'ERR_NOSUCHNICK',
    '402': 'ERR_NOSUCHSERVER',
    '404': 'ERR_CANNOTSENDTOCHAN',
    '405': 'ERR_TOOMANYCHANNELS',
    '406': 'ERR_WASNOSUCHNICK',
    '421': 'ERR_UNKNOWNCOMMAND',
    '422': 'ERR_NOMOTD',
    '423': 'ERR_NOADMININFO',
    '432': 'ERR_ERRONEUSNICKNAME',
    '433': 'ERR_NICKNAMEINUSE',
    '439': 'ERR_TARGETTOFAST',
    '441': 'ERR_USERNOTINCHANNEL',
    '442': 'ERR_NOTONCHANNEL',
    '443': 'ERR_USERONCHANNEL',
    '451': 'ERR_NOTREGISTERED',
    '461': 'ERR_NOTENOUGHPARAMS',
    '464': 'ERR_PASSWDMISMATCH',
    '470': 'ERR_LINKCHANNEL',
    '471': 'ERR_CHANNELISFULL',
    '472': 'ERR_UNKNOWNMODE',
    '473': 'ERR_INVITEONLYCHAN',
    '474': 'ERR_BANNEDFROMCHAN',
    '475': 'ERR_BADCHANNELKEY',
    '481': 'ERR_NOPRIVILEGES',
    '482': 'ERR_CHANOPRIVSNEEDED',
    '483': 'ERR_CANTKILLSERVER',
    '484': 'ERR_ISCHANSERVICE',
    '485': 'ERR_ISREALSERVICE',
    '491': 'ERR_NOOPERHOST',
    '670': 'RPL_STARTTLS',
    '671': 'RPL_WHOISSECURE',
    '716': 'RPL_TARGUMODEG',
    '717': 'RPL_TARGNOTIFY',
    '718': 'RPL_UMODEGMSG',
    '900': 'RPL_SASLAUTHENTICATED',
    '903': 'RPL_SASLLOGGEDIN',
    '904': 'ERR_SASLNOTAUTHORISED',
    '906': 'ERR_SASLABORTED',
    '907': 'ERR_SASLALREADYAUTHED',
    '931': 'RPL_ANTISPAMBOT',
    '972': 'ERR_CANNOTDOCOMMAND',
    'WALLOPS': 'RPL_WALLOPS'
};


function IrcCommandsHandler (irc_connection) {
    this.irc_connection = irc_connection;
    this.handlers = [];

    require('./commands/registration')(this);
    require('./commands/channel')(this);
    require('./commands/user')(this);
    require('./commands/messaging')(this);
    require('./commands/misc')(this);
}


IrcCommandsHandler.prototype.dispatch = function (irc_command) {
    var command_name = irc_command.command;

    // Check if we have a numeric->command name- mapping for this command
    if (irc_numerics[irc_command.command.toUpperCase()]) {
        command_name = irc_numerics[irc_command.command.toUpperCase()];
    }

    if (this.handlers[command_name]) {
        this.handlers[command_name].call(this, irc_command);
    } else {
        this.emitUnknownCommand(irc_command);
    }
};


IrcCommandsHandler.prototype.addHandler = function (command, handler) {
    if (typeof handler !== 'function') {
        return false;
    }
    this.handlers[command] = handler;
};


IrcCommandsHandler.prototype.addNumeric = function (numeric, handler_name) {
    irc_numerics[numeric + ''] = handler_name +'';
};


IrcCommandsHandler.prototype.emitUnknownCommand = function (command) {
    this.irc_connection.emit('server ' + this.irc_connection.irc_host.hostname + ' unknown_command', {
        command: command.command,
        params: command.params
    });
};


IrcCommandsHandler.prototype.emitGenericNotice = function (command, msg, is_error) {
    // Default to being an error
    if (typeof is_error !== 'boolean') {
        is_error = true;
    }

    this.irc_connection.emit('user ' + command.prefix + ' notice', {
        from_server: true,
        nick: command.prefix,
        ident: '',
        hostname: '',
        target: command.params[0],
        msg: msg,
        numeric: parseInt(command.command, 10)
    });
};


IrcCommandsHandler.prototype.emit = function() {
    return this.irc_connection.emit.apply(this.irc_connection, arguments);
};


/**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
IrcCommandsHandler.prototype.parseModeList = function (mode_string, mode_params) {
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





function IrcCommand(command, data) {
    this.command = command += '';
    this.params = _.clone(data.params);
    this.tags = _.clone(data.tags);

    this.prefix = data.prefix;
    this.nick = data.nick;
    this.ident = data.ident;
    this.hostname = data.hostname;
}


IrcCommand.prototype.getServerTime = function() {
    var time;

    // No tags? No times.
    if (!this.tags || this.tags.length === 0) {
        return;
    }

    time = _.find(this.tags, function (tag) {
        return tag.tag === 'time';
    });

    if (time) {
        time = time.value;
    }

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

    return time;
};





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


module.exports.Handler = IrcCommandsHandler;
module.exports.Command = IrcCommand;
var EventBinder  = require('./eventbinder.js');

var IrcUser = function (irc_connection, nick) {
    this.irc_connection = irc_connection;
    this.nick = nick;

    this.irc_events = {
        nick:           onNick,
        away:           onAway,
        quit:           onQuit,
        whoisuser:      onWhoisUser,
        whoisaway:      onWhoisAway,
        whoisoperator:  onWhoisOperator,
        whoischannels:  onWhoisChannels,
        whoismodes:     onWhoisModes,
        whoisidle:      onWhoisIdle,
        whoisregnick:   onWhoisRegNick,
        whoisserver:    onWhoisServer,
        whoishost:      onWhoisHost,
        whoissecure:    onWhoisSecure,
        whoisaccount:   onWhoisAccount,
        whoishelpop:    onWhoisHelpOp,
        whoisbot:       onWhoisBot,
        whoisswhois:    onWhoisSwhois,
        endofwhois:     onWhoisEnd,
        whowas:         onWhoWas,
        endofwhowas:    onWhoWasEnd,
        wasnosuchnick:  onWasNoSuchNick,
        notice:         onNotice,
        ctcp_response:  onCtcpResponse,
        privmsg:        onPrivmsg,
        action:         onAction,
        ctcp_request:   onCtcpRequest,
        mode:           onMode,
        wallops:        onWallops
    };
    EventBinder.bindIrcEvents('user ' + this.nick, this.irc_events, this, irc_connection);
};


module.exports = IrcUser;


IrcUser.prototype.dispose = function () {
    EventBinder.unbindIrcEvents('user ' + this.nick, this.irc_events, this.irc_connection);
};


function onNick(event) {
    this.irc_connection.clientEvent('nick', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        newnick: event.newnick,
        time: event.time
    });

    // TODO: uncomment when using an IrcUser per nick
    //EventBinder.unbindIrcEvents('user ' + this.nick, this.irc_events, irc_connection);
    //this.nick = event.newnick;
    //EventBinder.bindIrcEvents('user ' + this.nick, this.irc_events, this, irc_connection);
}

function onAway(event) {
    this.irc_connection.clientEvent('away', {
        nick: event.nick,
        msg: event.msg,
        time: event.time
    });
}

function onQuit(event) {
    this.irc_connection.clientEvent('quit', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        message: event.message,
        time: event.time
    });
}

function onWhoisUser(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.host,
        msg: event.msg,
        end: false
    });
}

function onWhoisAway(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        away_reason: event.reason,
        end: false
    });
}

function onWhoisServer(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        irc_server: event.irc_server,
        server_info: event.server_info,
        end: false
    });
}

function onWhoisOperator(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisChannels(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        chans: event.chans,
        end: false
    });
}

function onWhoisModes(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisIdle(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        idle: event.idle,
        logon: event.logon || undefined,
        end: false
    });
}

function onWhoisRegNick(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisHost(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisSecure(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: 'Using a secure connection',
        end: false
    });
}

function onWhoisAccount(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: 'Logged in as ' + event.account,
        end: false
    });
}

function onWhoisHelpOp(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisBot(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisSwhois(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: false
    });
}

function onWhoisEnd(event) {
    this.irc_connection.clientEvent('whois', {
        nick: event.nick,
        msg: event.msg,
        end: true
    });
}

function onWhoWas(event) {
    this.irc_connection.clientEvent('whowas', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.host,
        real_name: event.real_name,
        end: false
    });
}

function onWasNoSuchNick(event) {
    this.irc_connection.clientEvent('whowas', {
        nick: event.nick,
        end: false
    });
}

function onWhoWasEnd(event) {
    this.irc_connection.clientEvent('whowas', {
        nick: event.nick,
        end: true
    });
}

function onNotice(event) {
    var that = this;
    global.modules.emit('irc user notice', {
        connection: this.irc_connection,
        irc_event: event
    })
    .then(function() {
        that.irc_connection.clientEvent('message', {
            type: 'notice',
            from_server: event.from_server,
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            target: event.target,
            group: event.group,
            msg: event.msg,
            time: event.time
        });
    });
}

function onCtcpResponse(event) {
    this.irc_connection.clientEvent('ctcp_response', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        msg: event.msg,
        time: event.time
    });
}

function onPrivmsg(event) {
    var that = this;

    global.modules.emit('irc message', {
        connection: this.irc_connection,
        irc_event: event
    })
    .then(function() {
        that.irc_connection.clientEvent('message', {
            type: 'message',
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            target: event.target,
            msg: event.msg,
            time: event.time
        });
    });
}

function onAction(event) {
    var that = this;

    global.modules.emit('irc action', {
        connection: this.irc_connection,
        irc_event: event
    })
    .then(function() {
        that.irc_connection.clientEvent('message', {
            type: 'action',
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            target: event.target,
            msg: event.msg,
            time: event.time
        });
    });
}

function onCtcpRequest(event) {
    this.irc_connection.clientEvent('ctcp_request', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        type: event.type,
        msg: event.msg,
        time: event.time
    });
}

function onMode(event) {
    this.irc_connection.clientEvent('mode', {
        target: event.target,
        nick: event.nick,
        modes: event.modes,
        time: event.time
    });
}

function onWallops(event) {
    this.irc_connection.clientEvent('wallops', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        msg: event.msg,
        time: event.time
    });
}

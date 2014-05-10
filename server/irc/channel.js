var util        = require('util'),
    EventBinder = require('./eventbinder.js'),
    IrcUser     = require('./user.js');

var IrcChannel = function(irc_connection, name) {
    this.irc_connection = irc_connection;

    // Lowercase the channel name so we don't run into case-sensitive issues
    this.name = name.toLowerCase();

    this.members = [];
    this.ban_list_buffer = [];

    // Listen for events on the IRC connection
    this.irc_events = {
        join:           onJoin,
        part:           onPart,
        kick:           onKick,
        quit:           onQuit,
        privmsg:        onMsg,
        action:         onAction,
        notice:         onNotice,
        ctcp_request:   onCtcpRequest,
        ctcp_response:  onCtcpResponse,
        topic:          onTopic,
        userlist:       onNicklist,
        userlist_end:   onNicklistEnd,
        banlist:        onBanList,
        banlist_end:    onBanListEnd,
        topicsetby:     onTopicSetBy,
        mode:           onMode,
        info:           onChannelInfo
    };
    EventBinder.bindIrcEvents('channel ' + this.name, this.irc_events, this, irc_connection);
};


module.exports = IrcChannel;


IrcChannel.prototype.dispose = function (){
    EventBinder.unbindIrcEvents('channel ' + this.name, this.irc_events, this.irc_connection);
    this.irc_connection = undefined;
};



function onJoin(event) {
    var that = this;

    global.modules.emit('irc channel join', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('join', {
            channel: that.name,
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            time: event.time
        });
    });
}


function onPart(event) {
    var that = this;

    global.modules.emit('irc channel part', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('part', {
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            channel: that.name,
            message: event.message,
            time: event.time
        });
    });
}


function onKick(event) {
    var that = this;

    global.modules.emit('irc channel kick', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('kick', {
            kicked: event.kicked,  // Nick of the kicked
            nick: event.nick, // Nick of the kicker
            ident: event.ident,
            hostname: event.hostname,
            channel: that.name,
            message: event.message,
            time: event.time
        });
    });
}


function onQuit(event) {
    var that = this;

    global.modules.emit('irc channel quit', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('quit', {
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            message: event.message,
            time: event.time
        });
    });
}


function onMsg(event) {
    var that = this;

    global.modules.emit('irc message', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('msg', {
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            channel: that.name,
            msg: event.msg,
            time: event.time
        });
    });
}


function onAction(event) {
    var that = this;

    global.modules.emit('irc action', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('action', {
            nick: event.nick,
            ident: event.ident,
            hostname: event.hostname,
            channel: event.channel,
            msg: event.msg,
            time: event.time
        });
    });
}


function onNotice(event) {
    var that = this;

    global.modules.emit('irc channel notice', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('notice', {
            from_server: event.from_server,
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


function onCtcpResponse(event) {
    this.irc_connection.clientEvent('ctcp_response', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        type: event.type,
        msg: event.msg,
        time: event.time
    });
}


// TODO: Split event.users into batches of 50
function onNicklist(event) {
    this.irc_connection.clientEvent('userlist', {
        users: event.users,
        channel: this.name
    });
    // TODO: uncomment when using an IrcUser per nick
    //updateUsersList.call(this, event.users);
}


function onNicklistEnd(event) {
    this.irc_connection.clientEvent('userlist_end', {
        users: event.users,
        channel: this.name
    });
    // TODO: uncomment when using an IrcUser per nick
    //updateUsersList.call(this, event.users);
}

function updateUsersList(users) {
    var that = this;
    if (users) {
        users.forEach(function (user) {
            if (!that.irc_connection.irc_users[user.nick]) {
                that.irc_connection.irc_users[user.nick] = new IrcUser(that.irc_connection, user.nick);
            }
        });
    }
}


function onTopic(event) {
    var that = this;

    global.modules.emit('irc channel topic', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('topic', {
            nick: event.nick,
            channel: that.name,
            topic: event.topic,
            time: event.time
        });
    });
}


function onChannelInfo(event) {
    // Channel info event may contain 1 of several types of info,
    // including creation time, modes. So just pipe the event
    // right through to the client
    this.irc_connection.clientEvent('channel_info', event);
}


function onBanList(event) {
    this.ban_list_buffer.push(event);
}

function onBanListEnd(event) {
    this.irc_connection.clientEvent('banlist', {
        channel: this.name,
        bans: this.ban_list_buffer
    });

    this.ban_list_buffer = [];
}

function onTopicSetBy(event) {
    this.irc_connection.clientEvent('topicsetby', {
        nick: event.nick,
        channel: event.channel,
        when: event.when
    });
}

function onMode(event) {
    var that = this;

    global.modules.emit('irc channel mode', {
        channel: this,
        connection: this.irc_connection,
        irc_event: event
    })
    .done(function() {
        that.irc_connection.clientEvent('mode', {
            target: event.target,
            nick: event.nick,
            modes: event.modes,
            time: event.time
        });
    });
}

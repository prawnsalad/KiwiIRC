var util        = require('util'),
    EventBinder = require('./eventbinder.js'),
    IrcUser     = require('./user.js');

var IrcChannel = function(irc_connection, name) {
    this.irc_connection = irc_connection;
    this.name = name;

    this.members = [];
    this.ban_list_buffer = [];

    // Listen for events on the IRC connection
    this.irc_events = {
        join:           onJoin,
        part:           onPart,
        kick:           onKick,
        quit:           onQuit,
        privmsg:        onMsg,
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
    this.irc_connection.clientEvent('join', {
        channel: this.name,
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        time: event.time
    });
}


function onPart(event) {
    this.irc_connection.clientEvent('part', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message,
        time: event.time
    });
}


function onKick(event) {
    this.irc_connection.clientEvent('kick', {
        kicked: event.kicked,  // Nick of the kicked
        nick: event.nick, // Nick of the kicker
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message,
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


function onMsg(event) {
    this.irc_connection.clientEvent('msg', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        msg: event.msg,
        time: event.time
    });
}


function onNotice(event) {
    this.irc_connection.clientEvent('notice', {
        from_server: event.from_server,
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        msg: event.msg,
        time: event.time
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
    this.irc_connection.clientEvent('topic', {
        nick: event.nick,
        channel: this.name,
        topic: event.topic,
        time: event.time
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

function onTopic(event) {
    this.irc_connection.clientEvent('topic', {
        channel: event.channel,
        topic: event.topic
    });
}

function onTopicSetBy(event) {
    this.irc_connection.clientEvent('topicsetby', {
        nick: event.nick,
        channel: event.channel,
        when: event.when
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

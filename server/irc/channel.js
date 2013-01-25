var util    = require('util'),
    Binder  = require('./binder.js');

function IrcChannel(irc_connection, name) {
    this.irc_connection = irc_connection;
    this.name = name;

    this.scope = 'channel:' + name;
    Binder.call(this);
    
    this.members = [];
    this.ban_list_buffer = [];
}

util.inherits(IrcChannel, Binder);

module.exports = IrcChannel;


IrcChannel.prototype.dispose = function (){
    this.unbindEvents();
    this.irc_connection = undefined;
};


IrcChannel.prototype.irc_events = {
    join:           onJoin,
    part:           onPart,
    kick:           onKick,
    quit:           onQuit,
    privmsg:        onMsg,
    notice:         onNotice,
    ctcp_request:   onCtcpRequest,
    ctcp_response:  onCtcpResponse,
    topic:          onTopic,
    nicklist:       onNicklist,
    nicklistEnd:    onNicklistEnd,
    banlist:        onBanList,
    banlist_end:    onBanListEnd,
    topicsetby:     onTopicSetby,
    mode:           onMode
};


function onJoin(event) {
    this.irc_connection.sendIrcCommand('join', {
        channel: this.name,
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
    });

    // If we've just joined this channel then request get a nick list
    if (event.nick === this.irc_connection.nick) {
        this.irc_connection.write('NAMES ' + channel);
    }
};


function onPart(event) {
    this.irc_connection.sendIrcCommand('part', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message
    });

    this.dispose();
};


function onKick(event) {
    this.irc_connection.sendIrcCommand('kick', {
        kicked: event.kicked,  // Nick of the kicked
        nick: event.nick, // Nick of the kicker
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message
    });

    this.dispose();
};


function onQuit(event) {
    this.irc_connection.sendIrcCommand('quit', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        message: event.message
    });

    this.dispose();
};


function onMsg(event) {
    this.irc_connection.sendIrcCommand('msg', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        msg: event.message
    });
};


function onNotice(event) {
    this.irc_connection.sendIrcCommand('msg', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        msg: event.trailing
    });
};


function onCtcpRequest(event) {
    this.irc_connection.sendIrcCommand('ctcp_request', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        type: event.type,
        msg: event.msg
    });
};


function onCtcpResponse(event) {
    this.irc_connection.sendIrcCommand('ctcp_response', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        type: event.type,
        msg: event.msg
    });
};


// TODO: Split event.users into batches of 50
function onNicklist(event) {
    this.irc_connection.sendIrcCommand('userlist', {
        users: event.users,
        channel: this.name
    });
};


function onNicklistEnd(event) {
    this.irc_connection.sendIrcCommand('userlist_end', {
        users: event.users,
        channel: this.name
    });
};


function onTopic(event) {
    this.irc_connection.sendIrcCommand('topic', {
        nick: event.nick,
        channel: this.name,
        topic: event.topic
    });
};


function onBanList(event) {
    this.ban_list_buffer.push(event);
};

function onBanListEnd(event) {
    var that = this;
    this.ban_list_buffer.forEach(function (ban) {
        that.irc_connection.clientEvent('banlist', ban);
    });
    this.ban_list_buffer = [];
};

function onTopic(event) {
    this.irc_connection.clientEvent('topic', {
        channel: event.channel,
        topic: event.topic
    });
};

function onTopicSetBy(event) {
    this.irc_connection.clientEvent('topicsetby', {
        nick: event.nick,
        channel: event.channel,
        when: event.when
    });
};

function onMode(event) {
    this.irc_connection.clientEvent('mode', {
        target: event.target,
        nick: event.nick,
        modes: event.modes
    });
};


/*
server:event
server:*
channel:#channel:event
channel:*:event
user:event
user:*

Server disconnected:
    server:disconnect
    server:*

Joining channel #kiwiirc:
    channel:#kiwiirc:join
    channel:*:join

Channel message:
    channel:#kiwiirc:privmsg
    channel:*:privmsg

Private message:
    user:privmsg
    user:*
*/
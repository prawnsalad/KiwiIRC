
function IrcChannel(irc_connection, name) {
    var that = this;

	this.irc_connection = irc_connection;
	this.name = name;

	// Helper for binding listeners
	function bindEvent(event, fn) {
		irc_connection.on('channel:' + name + ':' + event, function () {
            fn.apply(that, arguments);
        });
	}

	bindEvent('join', this.onJoin);
	bindEvent('part', this.onPart);
	bindEvent('kick', this.onKick);
	bindEvent('quit', this.onQuit);

	bindEvent('privmsg', this.onMsg);
	bindEvent('notice', this.onNotice);
	bindEvent('ctcp', this.onCtcp);

    bindEvent('nicklist', this.onNicklist);
    bindEvent('nicklistEnd', this.onNicklistEnd);
}


IrcChannel.prototype.clientEvent = function (event_name, event) {
	event.server = this.irc_connection.con_num;
	this.irc_connection.state.sendIrcCommand(event_name, event);
};


IrcChannel.prototype.onJoin = function (event) {
	this.clientEvent('join', {
		channel: this.name,
		nick: event.nick,
		ident: event.ident,
		hostname: event.hostname,
	});

	// If we've just joined this channel then requesr=t get a nick list
    if (event.nick === this.irc_connection.nick) {
        this.irc_connection.write('NAMES ' + channel);
    }
};


IrcChannel.prototype.onPart = function (event) {
    this.clientEvent('part', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message
    });
};


IrcChannel.prototype.onKick = function (event) {
    this.client.sendIrcCommand('kick', {
        kicked: event.params[1],  // Nick of the kicked
        nick: event.nick, // Nick of the kicker
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        message: event.message
    });
};


IrcChannel.prototype.onQuit = function (event) {
    this.clientEvent('quit', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        message: event.message
    });
};


IrcChannel.prototype.onMsg = function (event) {
    this.clientEvent('msg', {
        server: this.con_num,
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        msg: event.message
    });
};


IrcChannel.prototype.onNotice = function (event) {
    this.clientEvent('msg', {
        server: this.con_num,
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        channel: this.name,
        msg: event.trailing
    });
};


IrcChannel.prototype.onCtcp = function (event) {
    this.clientEvent('ctcp_request', {
        nick: event.nick,
        ident: event.ident,
        hostname: event.hostname,
        target: event.target,
        type: event.type,
        msg: event.msg
    });
};


// TODO: Split event.users into batches of 50
IrcChannel.prototype.onNicklist = function (event) {
    this.clientEvent('userlist', {
        users: event.users,
        channel: this.name
    });
};


IrcChannel.prototype.onNicklistEnd = function (event) {
    this.clientEvent('userlist_end', {
        users: event.users,
        channel: this.name
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
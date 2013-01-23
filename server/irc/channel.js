
function IrcChannel(irc_connection, name) {
	this.irc_connection = irc_connection;
	this.name = name;

	// Helper for binding listeners
	function bindEvent(event, fn) {
		irc_connection.on('channel:' + name + ':' + event, fn);
	}

	bindEvent('join', this.onJoin);
	bindEvent('part', this.onPart);
	bindEvent('kick', this.onKick);
	bindEvent('quit', this.onQuit);

	bindEvent('privmsg', this.onMsg);
	bindEvent('notice', this.onNotice);
	bindEvent('ctcp', this.onCtcp);
}


// TODO: Move this into irc_connection
ircChannel.prototype.clientEvent = function (event_name, event) {
	event.server = this.irc_connection.con_num;
	this.client.sendIrcCommand(event_name, event);
};


IrcChannel.prototype.onJoin = function (event) {
	this.clientEvent('join', {
		channel: this.name,
		nick: command.nick,
		ident: command.ident,
		hostname: command.hostname,
	});

	// If we've just joined this channel then requesr=t get a nick list
    if (event.nick === this.irc_connection.nick) {
        this.irc_connection.write('NAMES ' + channel);
    }
};


IrcChannel.prototype.removeUser = function (event) {
	type = type || 'part';

	this.emit('')
}


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
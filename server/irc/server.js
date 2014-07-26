var util    = require('util'),
    EventBinder  = require('./eventbinder.js'),
    _ = require('lodash');

var IrcServer = function (irc_connection) {
    this.irc_connection = irc_connection;

    this.list_buffer = [];
    this.motd_buffer = '';

    // Date when registeration with the IRCd had completed
    this.registered = false;

    this.irc_events = {
        connect:                onConnect,
        options:                onOptions,
        list_start:             onListStart,
        list_channel:           onListChannel,
        list_end:               onListEnd,
        motd_start:             onMotdStart,
        motd:                   onMotd,
        motd_end:               onMotdEnd,
        error:                  onError,
        password_mismatch:      onPasswordMismatch,
        channel_redirect:       onChannelRedirect,
        no_such_nick:           onNoSuchNick,
        cannot_send_to_channel: onCannotSendToChan,
        too_many_channels:      onTooManyChannels,
        user_not_in_channel:    onUserNotInChannel,
        not_on_channel:         onNotOnChannel,
        channel_is_full:        onChannelIsFull,
        invite_only_channel:    onInviteOnlyChannel,
        user_on_channel:        onUserAlreadyInChannel,
        banned_from_channel:    onBannedFromChannel,
        bad_channel_key:        onBadChannelKey,
        chanop_privs_needed:    onChanopPrivsNeeded,
        nickname_in_use:        onNicknameInUse,
        erroneus_nickname:      onErroneusNickname,
        unknown_command:        onUnknownCommand
    };
    EventBinder.bindIrcEvents('server *', this.irc_events, this, this.irc_connection);

};


module.exports = IrcServer;


IrcServer.prototype.dispose = function (){
    EventBinder.unbindIrcEvents('server *', this.irc_events, this.irc_connection);
    this.irc_connection = undefined;
};


IrcServer.prototype.reset = function() {
    this.registered = false;
    this.list_buffer = [];
    this.motd_buffer = '';
};



function onConnect(event) {
    this.registered = new Date();

    this.irc_connection.clientEvent('connect', {
        nick: event.nick
    });
}

function onOptions(event) {
    this.irc_connection.clientEvent('options', {
        options: event.options,
        cap: event.cap
    });
}

function onListStart(event) {
    this.irc_connection.clientEvent('list_start', {});
    this.list_buffer = [];
    this.busy_listing = true;
}

function onListChannel(event) {
    var buf;
    if (!this.busy_listing) {
      onListStart.call(this);
    }
    this.list_buffer.push({
        channel: event.channel,
        num_users: event.num_users,
        topic: event.topic
    });

    if (this.list_buffer.length > 200) {
        buf = _.sortBy(this.list_buffer, function (channel) {
            // sortBy sorts in ascending order, we want to sort by descending, hence using 0 - num_users.
            return 0 - channel.num_users;
        });
        this.irc_connection.clientEvent('list_channel', {
            chans: buf
        });
        this.list_buffer = [];
    }
}

function onListEnd(event) {
    var buf;

    buf = _.sortBy(this.list_buffer, function (channel) {
        // sortBy sorts in ascending order, we want to sort by descending, hence using 0 - num_users.
        return 0 - channel.num_users;
    });
    this.irc_connection.clientEvent('list_channel', {
        chans: buf
    });
    this.list_buffer = [];
    this.busy_listing = false;

    this.irc_connection.clientEvent('list_end', {});
}

function onMotdStart(event) {
    this.motd_buffer = '';
}

function onMotd(event) {
    this.motd_buffer += event.motd;
}

function onMotdEnd(event) {
    this.irc_connection.clientEvent('motd', {
        msg: this.motd_buffer
    });
}

function onError(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'error',
        reason: event.reason
    });
}

function onPasswordMismatch(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'password_mismatch'
    });
}

function onChannelRedirect(event) {
    this.irc_connection.clientEvent('channel_redirect', {
        from: event.from,
        to: event.to
    });
}

function onNoSuchNick(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'no_such_nick',
        nick: event.nick,
        reason: event.reason
    });
}

function onCannotSendToChan(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'cannot_send_to_channel',
        channel: event.channel,
        reason: event.reason
    });
}

function onTooManyChannels(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'too_many_channels',
        channel: event.channel,
        reason: event.reason
    });
}

function onUserNotInChannel(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'user_not_in_channel',
        nick: event.nick,
        channel: event.channel,
        reason: event.reason
    });
}

function onNotOnChannel(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'not_on_channel',
        channel: event.channel,
        reason: event.reason
    });
}

function onChannelIsFull(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'channel_is_full',
        channel: event.channel,
        reason: event.reason
    });
}

function onInviteOnlyChannel(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'invite_only_channel',
        channel: event.channel,
        reason: event.reason
    });
}

function onUserAlreadyInChannel(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'user_on_channel',
        channel: event.channel,
        nick: event.nick
    });
}

function onBannedFromChannel(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'banned_from_channel',
        channel: event.channel,
        reason: event.reason
    });
}

function onBadChannelKey(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'bad_channel_key',
        channel: event.channel,
        reason: event.reason
    });
}

function onChanopPrivsNeeded(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'chanop_privs_needed',
        channel: event.channel,
        reason: event.reason
    });
}

function onNicknameInUse(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'nickname_in_use',
        nick: event.nick,
        reason: event.reason
    });
}

function onErroneusNickname(event) {
    this.irc_connection.clientEvent('irc_error', {
        error: 'erroneus_nickname',
        nick: event.nick,
        reason: event.reason
    });
}

function onUnknownCommand(event) {
    this.irc_connection.clientEvent('unknown_command', {
        error: 'unknown_command',
        command: event.command,
        params: event.params
    });
}

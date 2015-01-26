var _ = require('lodash');

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};


var handlers = {
    RPL_CHANNELMODEIS: function (command) {
        var channel = command.params[1],
            modes = this.parseModeList.call(this, command.params[2], command.params.slice(3));

        this.emit('channel ' + channel + ' info', {
            channel: channel,
            modes: modes
        });
    },


    RPL_CREATIONTIME: function (command) {
        var channel = command.params[1];

        this.emit('channel ' + channel + ' info', {
            channel: channel,
            created_at: parseInt(command.params[2], 10)
        });
    },


    RPL_CHANNEL_URL: function (command) {
        var channel = command.params[1];

        this.emit('channel ' + channel + ' info', {
            channel: channel,
            url: command.params[command.params.length - 1]
        });
    },


    RPL_NAMEREPLY: function (command) {
        var members = command.params[command.params.length - 1].split(' ');
        var member_list = [];
        var that = this;
        _.each(members, function (member) {
            var i = 0,
                j = 0,
                modes = [];

            // Make sure we have some prefixes already
            if (that.irc_connection.options.PREFIX) {
                for (j = 0; j < that.irc_connection.options.PREFIX.length; j++) {
                    if (member.charAt(i) === that.irc_connection.options.PREFIX[j].symbol) {
                        modes.push(that.irc_connection.options.PREFIX[j].mode);
                        i++;
                    }
                }
            }

            member_list.push({nick: member, modes: modes});
        });

        this.emit('channel ' + command.params[2] + ' userlist', {
            users: member_list,
            channel: command.params[2]
        });
    },


    RPL_ENDOFNAMES: function (command) {
        this.emit('channel ' + command.params[1] + ' userlist_end', {
            channel: command.params[1]
        });
    },


    RPL_BANLIST: function (command) {
        this.emit('channel ' + command.params[1] + ' banlist', {
            channel: command.params[1],
            banned: command.params[2],
            banned_by: command.params[3],
            banned_at: command.params[4]
        });
    },


    RPL_ENDOFBANLIST: function (command) {
        this.emit('channel ' + command.params[1] + ' banlist_end', {
            channel: command.params[1]
        });
    },


    RPL_TOPIC: function (command) {
        this.emit('channel ' + command.params[1] + ' topic', {
            channel: command.params[1],
            topic: command.params[command.params.length - 1]
        });
    },


    RPL_NOTOPIC: function (command) {
        this.emit('channel ' + command.params[1] + ' topic', {
            channel: command.params[1],
            topic: ''
        });
    },


    RPL_TOPICWHOTIME: function (command) {
        this.emit('channel ' + command.params[1] + ' topicsetby', {
            nick: command.params[2],
            channel: command.params[1],
            when: command.params[3]
        });
    },


    JOIN: function (command) {
        var channel, time;
        if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('channel ' + channel + ' join', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: channel,
            time: time
        });
    },


    PART: function (command) {
        var time, channel, message;

        // Check if we have a server-time
        time = command.getServerTime();

        channel = command.params[0];
        if (command.params.length > 1) {
            message = command.params[command.params.length - 1];
        }

        this.emit('channel ' + channel + ' part', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: channel,
            message: message,
            time: time
        });
    },


    KICK: function (command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('channel ' + command.params[0] + ' kick', {
            kicked: command.params[1],
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1],
            time: time
        });
    },


    QUIT: function (command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('user ' + command.nick + ' quit', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1],
            time: time
        });
    },


    TOPIC: function (command) {
        var time;

        // If we don't have an associated channel, no need to continue
        if (!command.params[0]) {
            return;
        }

        // Check if we have a server-time
        time = command.getServerTime();

        var channel = command.params[0],
            topic = command.params[command.params.length - 1] || '';

        this.emit('channel ' + channel + ' topic', {
            nick: command.nick,
            channel: channel,
            topic: topic,
            time: time
        });
    },


    RPL_INVITING: function (command) {
        this.emit('channel ' + command.params[1] + ' invited', {
            nick: command.params[0],
            channel: command.params[1]
        });
    },
};
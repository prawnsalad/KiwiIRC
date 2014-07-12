var _ = require('lodash');

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};


var handlers = {
    AWAY: function (command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('user ' + command.nick + ' away', {
            nick: command.nick,
            msg: command.params[command.params.length - 1],
            time: time
        });
    },


    RPL_ENDOFWHOIS: function (command) {
        this.emit('user ' + command.params[1] + ' endofwhois', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_AWAY: function (command) {
        this.emit('user ' + command.params[1] + ' whoisaway', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISUSER: function (command) {
        this.emit('user ' + command.params[1] + ' whoisuser', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISHELPOP: function (command) {
        this.emit('user ' + command.params[1] + ' whoishelpop', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISBOT: function (command) {
        this.emit('user ' + command.params[1] + ' whoisbot', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISSERVER: function (command) {
        this.emit('user ' + command.params[1] + ' whoisserver', {
            nick: command.params[1],
            irc_server: command.params[2],
            server_info: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISOPERATOR: function (command) {
        this.emit('user ' + command.params[1] + ' whoisoperator', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISCHANNELS:       function (command) {
        this.emit('user ' + command.params[1] + ' whoischannels', {
            nick: command.params[1],
            chans: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISMODES: function (command) {
        this.emit('user ' + command.params[1] + ' whoismodes', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISIDLE: function (command) {
        this.emit('user ' + command.params[1] + ' whoisidle', {
            nick: command.params[1],
            idle: command.params[2],
            logon: command.params[3] || undefined
        });
    },

    RPL_WHOISREGNICK: function (command) {
        this.emit('user ' + command.params[1] + ' whoisregnick', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISHOST: function (command) {
        this.emit('user ' + command.params[1] + ' whoishost', {
            nick: command.params[1],
            msg: command.params[command.params.length - 1]
        });
    },

    RPL_WHOISSECURE: function (command) {
        this.emit('user ' + command.params[1] + ' whoissecure', {
            nick: command.params[1]
        });
    },

    RPL_WHOISACCOUNT: function (command) {
        this.emit('user ' + command.params[1] + ' whoisaccount', {
            nick: command.params[1],
            account: command.params[2]
        });
    },

    RPL_WHOWASUSER: function (command) {
        this.emit('user ' + command.params[1] + ' whowas', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            real_name: command.params[command.params.length - 1]
        });
    },

    RPL_ENDOFWHOWAS: function (command) {
        this.emit('user ' + command.params[1] + ' endofwhowas', {
            nick: command.params[1]
        });
    },

    ERR_WASNOSUCHNICK: function (command) {
        this.emit('user ' + command.params[1] + ' wasnosucknick', {
            nick: command.params[1]
        });
    },
};
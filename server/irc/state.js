var util            = require('util'),
    events          = require('events'),
    _               = require('lodash'),
    IrcConnection   = require('./connection.js').IrcConnection;

var State = function (client, save_state) {
    var that = this;

    events.EventEmitter.call(this);
    this.client = client;
    this.save_state = save_state || false;
    
    this.irc_connections = [];
    this.next_connection = 0;
    
    this.client.on('dispose', function () {
        if (!that.save_state) {
            _.each(that.irc_connections, function (irc_connection, i, cons) {
                if (irc_connection) {
                    irc_connection.end('QUIT :' + (global.config.quit_message || ''));
                    irc_connection.dispose();
                    cons[i] = null;
                }
            });
            
            that.dispose();
        }
    });
};

util.inherits(State, events.EventEmitter);

module.exports = State;

State.prototype.connect = function (hostname, port, ssl, nick, user, pass, callback) {
    var that = this;
    var con, con_num;
    if (global.config.restrict_server) {
        con = new IrcConnection(
            global.config.restrict_server,
            global.config.restrict_server_port,
            global.config.restrict_server_ssl,
            nick,
            user,
            global.config.restrict_server_password,
            this);

    } else {
        con = new IrcConnection(
            hostname,
            port,
            ssl,
            nick,
            user,
            pass,
            this);
    }
    
    con_num = this.next_connection++;
    this.irc_connections[con_num] = con;
    con.con_num = con_num;
    
    new IrcCommands(con, con_num, this).bindEvents();
    
    con.on('connected', function () {
        return callback(null, con_num);
    });
    
    con.on('error', function (err) {
        console.log('irc_connection error (' + hostname + '):', err);
        return callback(err.code, {server: con_num, error: err});
    });

    con.on('close', function () {
        that.irc_connections[con_num] = null;
    });
};

State.prototype.sendIrcCommand = function () {
    this.client.sendIrcCommand.apply(this.client, arguments);
};

State.prototype.sendKiwiCommand = function () {
    this.client.sendKiwicommand.apply(this.client, arguments);
};

State.prototype.dispose = function () {
    this.emit('dispose');
    this.removeAllListeners();
};

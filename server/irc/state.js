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
                    global.servers.removeConnection(irc_connection);
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

    // Check the per-server limit on the number of connections
    if ((global.config.max_server_conns > 0) &&
        (!global.config.restrict_server) &&
        (!(global.config.webirc_pass && global.config.webirc_pass[hostname])) &&
        (!(global.config.ip_as_username && _.contains(global.config.ip_as_username, hostname))) &&
        (global.servers.numOnHost(hostname) >= global.config.max_server_conns))
    {
        return callback('Too many connections to host', {host: hostname, limit: global.config.max_server_conns});
    }

    con = new IrcConnection(
        hostname,
        port,
        ssl,
        nick,
        user,
        pass,
        this);
    
    con_num = this.next_connection++;
    this.irc_connections[con_num] = con;
    con.con_num = con_num;
    
    new IrcCommands(con, con_num, this).bindEvents();
    
    con.on('connected', function () {
        global.servers.addConnection(this);
        return callback(null, con_num);
    });
    
    con.on('error', function (err) {
        console.log('irc_connection error (' + hostname + '):', err);
        return callback(err.code, {server: con_num, error: err});
    });

    con.on('close', function () {
        // TODO: Can we get a better reason for the disconnection? Was it planned?
        that.sendIrcCommand('disconnect', {server: con.con_num, reason: 'disconnected'});

        that.irc_connections[con_num] = null;
        global.servers.removeConnection(this);
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

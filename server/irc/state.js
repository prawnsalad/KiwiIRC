var util            = require('util'),
    events          = require('events'),
    _               = require('lodash'),
    winston         = require('winston'),
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

State.prototype.connect = function (hostname, port, ssl, nick, user, options, callback) {
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

    con_num = this.next_connection++;
    con = new IrcConnection(
        hostname,
        port,
        ssl,
        nick,
        user,
        options,
        this,
        con_num);

    this.irc_connections[con_num] = con;

    con.on('connected', function IrcConnectionConnection() {
        global.servers.addConnection(this);
        return callback(null, con_num);
    });

    con.on('error', function IrcConnectionError(err) {
        winston.warn('irc_connection error (%s):', hostname, err);
        return callback(err.message);
    });

    con.on('close', function IrcConnectionClose() {
        // TODO: Can we get a better reason for the disconnection? Was it planned?
        that.sendIrcCommand('disconnect', {connection_id: con.con_num, reason: 'disconnected'});

        that.irc_connections[con_num] = null;
        global.servers.removeConnection(this);
    });

    // Call any modules before making the connection
    global.modules.emit('irc connecting', {state: this, connection: con})
        .done(function () {
            con.connect();
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

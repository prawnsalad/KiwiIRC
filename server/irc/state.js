var util            = require('util'),
    events          = require('events'),
    crypto          = require('crypto'),
    _               = require('lodash'),
    IrcConnection   = require('./connection.js').IrcConnection;

var State = function (save_state) {
    var that = this;

    events.EventEmitter.call(this);
    this.clients = [];
    this.save_state = save_state || false;

    this.irc_connections = [];
    this.next_connection = 0;

    // A hash to identify this state instance
    this.hash = crypto.createHash('sha256')
        .update('' + Date.now())
        .update(Math.floor(Math.random() * 100000).toString())
        .digest('hex');

    global.states.addState(this);
};

util.inherits(State, events.EventEmitter);

module.exports = State;

State.prototype.addClient = function(client) {
    var that = this;

    this.clients.push(client);
    client.on('dispose', function() {
        that.clients = _.reject(that.clients, client);

        // If no more connected clients *and* we don't need to persist this state, shut. everything. down.
        if (that.clients.length == 0 && !that.save_state) {
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
}

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
        console.log('irc_connection error (' + hostname + '):', err);
        return callback(err.code);
    });

    con.on('close', function IrcConnectionClose() {
        // TODO: Can we get a better reason for the disconnection? Was it planned?
        that.sendIrcCommand('disconnect', {server: con.con_num, reason: 'disconnected'});

        that.irc_connections[con_num] = null;
        global.servers.removeConnection(this);
    });

    // Call any modules before making the connection
    global.modules.emit('irc connecting', {connection: con})
        .done(function () {
            con.connect();
        });
};

State.prototype.sendIrcCommand = function () {
    var args = arguments;
    _.each(this.clients, function(client, idx) {
        client.sendIrcCommand.apply(client, args);
    });
};

State.prototype.sendKiwiCommand = function () {
    var args = arguments;
    _.each(this.clients, function(client, idx) {
        client.sendKiwicommand.apply(client, args);
    });
};

State.prototype.dispose = function () {
    this.emit('dispose');
    this.removeAllListeners();

    global.states.removeState(this);
};

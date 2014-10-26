var util            = require('util'),
    events          = require('events'),
    crypto          = require('crypto'),
    _               = require('lodash'),
    winston         = require('winston'),
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
            that.dispose();
        }
    });
}

State.prototype.closeAllConnections = function() {
    _.each(this.irc_connections, function (irc_connection, i, cons) {
        if (irc_connection) {
            irc_connection.end('QUIT :' + (irc_connection.quit_message || global.config.quit_message || ''));
            global.servers.removeConnection(irc_connection);
            cons[i] = null;
        }
    });
};

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

    // con_num/connection_id may be given (restoring a state). If not, create a new one.
    // Always increment the next ID so we don't overwrite any existing connection IDs
    this.next_connection++;

    con_num = options.connection_id || this.next_connection;
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
        return callback && callback(null, con_num);
    });

    con.on('error', function IrcConnectionError(err) {
        var context = '';

        // If we have any of the last lines stored, include them in the log for context
        if (con.last_few_lines.length > 0) {
            context = '\n' + con.last_few_lines.join('\n') + '\n';
        }

        winston.warn('irc_connection error (%s):' + context, hostname, err);
        return callback(err.message);
    });

    con.on('reconnecting', function IrcConnectionReconnecting() {
        that.sendIrcCommand('disconnect', {connection_id: con.con_num, reason: 'IRC server reconnecting'});
    });

    con.on('close', function IrcConnectionClose() {
        // TODO: Can we get a better reason for the disconnection? Was it planned?
        that.sendIrcCommand('disconnect', {connection_id: con.con_num, reason: 'disconnected'});

        that.irc_connections[con_num] = null;
        global.servers.removeConnection(this);
    });

    // Call any modules before making the connection
    global.modules.emit('irc connecting', {state: this, connection: con})
        .then(function () {
            con.connect();
        });

    return con_num;
};

State.prototype.sendIrcCommand = function (irc_connection, event_name, data, callback) {
    var that = this,
        args = [event_name, data, callback];

    this.emit('client_event', 'irc', {
        connection: irc_connection,
        event: [event_name, data]
    });

    _.each(this.clients, function(client) {
        var target = data.target||data.channel;

        if (!target || client.isSubscribed(irc_connection.con_num, that.targetFromEvent(args, irc_connection))) {
            client.sendIrcCommand.apply(client, args);
        } else {
            console.log('NOT SUBSCRIBED', data.target||data.channel, event_name, data);
        }
    });
};

State.prototype.sendKiwiCommand = function () {
    var args = arguments;

    this.emit('client_event', 'kiwi', {
        event: Array.prototype.slice.call(arguments)
    });

    _.each(this.clients, function(client) {
        client.sendKiwicommand.apply(client, args);
    });
};

// From an IRC event being sent to the browser, extract the target/buffer name
State.prototype.targetFromEvent = function(event, irc_connection) {
    var target = '*';

    if (event[1].target === irc_connection.nick) {
        target = event[1].nick;

    } else if (event[1].target) {
        target = event[1].target;

    } else if(event[1].channel) {
        target = event[1].channel;
    }

    return target;
};

State.prototype.dispose = function () {
    this.emit('dispose');

    this.closeAllConnections();
    this.removeAllListeners();

    global.states.removeState(this);
};

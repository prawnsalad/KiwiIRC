var util            = require('util'),
    events          = require('events'),
    crypto          = require('crypto'),
    _               = require('lodash'),
    IrcConnection   = require('./connection.js').IrcConnection,
    IrcCommands     = require('./commands.js');

var State = function (save_state) {
    var that = this;

    events.EventEmitter.call(this);
    this.save_state = save_state || false;
    
    this.irc_connections = [];
    this.next_connection = 0;

    // Stored in storage
    this.saved_persistence = false;

    // Array of connected clients to this state
    this.client = [];

    // A hash to identify this client instance
    this.hash = crypto.createHash('sha256')
        .update(Date.now().toString())
        .update((Math.random() * 100000).toString())
        .digest('hex');

    global.states.add(this);
};

util.inherits(State, events.EventEmitter);

module.exports = State;


State.prototype.savePersistence = function(callback) {
    var that = this;

    // Go through and save each irc_connection
    global.storage.putState('darren', this.hash, function() {
        _.each(that.irc_connections, function (irc_connection) {
            if (!irc_connection) return;

            global.storage.putConnection(that.hash, irc_connection.con_num, {
                nick: irc_connection.nick,
                user: irc_connection.user,
                username: irc_connection.username,
                password: irc_connection.password,
                server_host: irc_connection.irc_host.hostname,
                server_port: irc_connection.irc_host.port,
                server_ssl: irc_connection.ssl
            }, function() {
                    that.save_state = true;
                    that.saved_persistence = true;

                    // Save all the channels in this connection
                    _.each(irc_connection.irc_channels, function(channel) {
                        global.storage.putChannel(
                            that.hash,
                            irc_connection.con_num,
                            channel.name,
                            {name: channel.name}
                        );
                    });
            });

            callback && callback();
        });
    });
}
State.prototype.stopPersistence = function(callback) {
    global.storage.delState('darren', this.hash, callback);
    this.save_state = false;
    this.saved_persistence = true;
};

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

    // Get a connection number for this new connection object
    this.next_connection++;
    con_num = this.next_connection;

    // If we're not saving state or we have already saved state, dont save again.
    if (!this.save_state || this.saved_persistence) {
        doConnect();
    } else {
        this.savePersistence(doConnect)
    }

    function doConnect() {
        con = new IrcConnection(
            hostname,
            port,
            ssl,
            nick,
            user,
            pass,
            that,
            con_num
        );
        
        that.irc_connections[con_num] = con;
        
        con.irc_commands = new IrcCommands(con, con_num, that);
        
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
        });

        con.on('dispose', function () {
            that.irc_connections[con_num] = null;
            global.servers.removeConnection(this);
        });

        // Call any modules before making the connection
        global.modules.emit('irc connecting', {connection: con})
            .done(function () {
                con.connect();
            });
    }
};



State.prototype.attachClient = function (new_client) {
    if (!_.contains(this.client, new_client))
        this.client.push(new_client);
};


State.prototype.detachClient = function (old_client) {
    var that = this;

    // Remove this client from our list
    this.client = _.reject(this.client, function(client) {
        return client === old_client;
    });
    
    // If we have no more connected clients and we're not saving this
    // state, dispose of everything
    if (_.size(this.client) === 0 && !that.save_state) {
        _.each(that.irc_connections, function (irc_connection, i, cons) {
            if (irc_connection) {
                irc_connection.end('QUIT :' + (global.config.quit_message || ''));
                irc_connection.dispose();
                global.servers.removeConnection(irc_connection);
            }
        });
        
        that.dispose();
    }
};


State.prototype.sendIrcCommand = function () {
    var args = arguments;

    _.each(this.client, function(client) {
        client.sendIrcCommand.apply(client, args);
    });
};

State.prototype.sendKiwiCommand = function () {
    this.client.sendKiwicommand.apply(this.client, arguments);
};

State.prototype.dispose = function () {
    global.states.remove(this);
    global.storage.delState('darren', this.hash);
    this.emit('dispose');
    this.removeAllListeners();
};

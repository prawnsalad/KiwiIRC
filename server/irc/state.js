var util            = require('util'),
    events          = require('events'),
    crypto          = require('crypto'),
    _               = require('lodash'),
    IrcConnection   = require('./connection.js').IrcConnection;

var State = function (save_state) {
    var that = this;

    events.EventEmitter.call(this);
    this.save_state = save_state || false;
    
    this.irc_connections = [];
    this.next_connection = 0;

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
    console.log(this.client, this.client.lengthm, _.size(this.client));
    
    // If we have no more connected clients and we're not saving this
    // state, dispose of everything
    if (_.size(this.client) === 0 && !that.save_state) {
        _.each(that.irc_connections, function (irc_connection, i, cons) {
            if (irc_connection) {
                irc_connection.end('QUIT :' + (global.config.quit_message || ''));
                irc_connection.dispose();
                cons[i] = null;
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
    this.emit('dispose');
    this.removeAllListeners();
};

/**
 * Persistent IRC connections (BNC mode)
 */

var kiwiModules = require('../../server/modules'),
    _ = require('lodash'),
    storage, storage_engine;


// Create a storage engine, default being memory
if (global.config.persistence && global.config.persistence.storage) {
    storage_engine = global.config.persistence.storage;
} else {
    storage_engine = 'memory';
}

storage = require('./drivers/' + storage_engine);
storage = new storage();


var module = new kiwiModules.Module('persistence');
var rpc_commands = {};


/**
 * Store events for a state that are sent to the client for persistence
 */
function handleEvents(state) {
    var state_id = state.hash;

    state.on('client_event', function(event_type, data) {
        // Only interested in IRC events being sent to the client
        if (event_type !== 'irc')
            return;

        // Default target is *, the server window
        var target = '*';

        // Only store certain event types (types the user will be visually interested in)
        var allowed_events = ['message', 'topic', 'mode', 'channel', 'quit'];
        if (allowed_events.indexOf(data.event[0]) === -1)
            return;

        if (data.event[1].target == data.connection.nick) {
            target = data.event[1].nick;
        } else if (data.event[1].target) {
            target = data.event[1].target;
        } else if(data.event[1].channel) {
            target = data.event[1].channel;
        }

        // If channel joining/parting/kicks do not involve us, don't store it.
        if (
            data.event[0] == 'channel' && data.event[1].type == 'kick' &&
            data.event[1].kicked.toLowerCase() !== data.connection.nick.toLowerCase()
        ) {
            return;
        } else if (
            (data.event[0] == 'channel' || data.event[0] == 'quit') &&
            data.event[1].nick.toLowerCase() !== data.connection.nick.toLowerCase()
        ) {
            return;
        }

        storage.putStateEvent(state_id, target, data.event);
    });
}


module.on('client created', function(event, event_data) {
    console.log('Adding persistent RPC methods');
    event_data.client.rpc.on('kiwi.session_save', _.bind(rpc_commands.sessionSave, event_data.client));
    event_data.client.rpc.on('kiwi.session_resume', _.bind(rpc_commands.sessionResume, event_data.client));
    event_data.client.rpc.on('kiwi.session_events', _.bind(rpc_commands.sessionEvents, event_data.client));
});


/**
 * Called within context of the client object
 */
rpc_commands.sessionSave = function(callback, event_data) {
    var that = this,
        auth = {};

    auth.credentials = {
        username: event_data.username,
        password: event_data.password,
    };

    global.modules.emit('auth attempt', auth)
    .done(function() {
        if (!auth.success) {
            callback('invalid_auth');
            return;
        }

        // If this user already has a state, kill and replace it
        storage.getUserState(auth.user_id, function(state) {
            if (state) {
                state.save_state = false;
                state.dispose();
                state = null;
            }

            storage.setUserState(auth.user_id, that.state, function() {
                that.state.save_state = true;

                handleEvents(that.state);
                callback(null, 'Sate will now persist');
            });
        });
    });
};

rpc_commands.sessionResume = function(callback, event_data) {
    var that = this,
        connections = [],
        auth = {};

    auth.credentials = {
        username: event_data.username,
        password: event_data.password,
    };

    global.modules.emit('auth attempt', auth)
    .done(function() {
        if (!auth.success) {
            callback('invalid_auth');
            return;
        }

        storage.getUserState(auth.user_id, function(state) {
            if (!state) {
                callback('does_not_exist');
                return;
            }

            if (that.state)
                that.state.dispose();

            state.addClient(that);
            that.state = state;

            // Unsubscribe from any targets. The client will subscribe later
            that.unsubscribe();

            // First loop - compile a list of connection information
            _.each(state.irc_connections, function(irc_connection) {
                if (!irc_connection)
                    return;

                var connection = {
                    connection_id: irc_connection.con_num,
                    options: irc_connection.server.cache.options || {},
                    nick: irc_connection.nick,
                    address: irc_connection.irc_host.hostname,
                    port: irc_connection.irc_host.port,
                    ssl: irc_connection.ssl,
                    channels: []
                };

                _.each(irc_connection.irc_channels, function(chan, chan_name) {
                    connection.channels.push({
                        name: chan_name
                    });
                });

                connections.push(connection);
            });

            // Send the connection information to the client
            callback(null, connections);

            // Second loop - Now the client has the info, sync some data
            _.each(state.irc_connections, function(irc_connection) {
                if (!irc_connection)
                    return;

                // Get a fresh MOTD sent to the client
                irc_connection.write('MOTD');
            });
        });
    });
};


rpc_commands.sessionEvents = function(callback, event_data) {
    var connection_id = event_data.connection_id,
        target = event_data.target,
        state = this.state,
        client = this;

    var connection = _.find(state.irc_connections, {con_num: connection_id});

    if (!connection) {
        console.log('connection not found', connection_id);
        return callback('connection_not_found');
    }
console.log('connection found', connection_id);

    // Subscribe the client to events to this connection/target
    client.subscribe(connection_id, target);

    // Refresh topics/nicklists for each requested channel
    _.each(connection.irc_channels, function(channel, channel_name) {
        console.log('Sync channel is match:', target, channel_name);
        // If we're looking for a specific target and this isn't it, ignore it
        if (target && target.toLowerCase() !== channel_name.toLowerCase())
            return;

        channel.refreshNickList();
        channel.refreshTopic();
    });

    // Get all targets that have events to be read
    storage.getTargets(state.hash, function(targets) {
console.log('targets:', targets);
        // Send each targets events down to the client
        _.each(targets, function(target_name) {
            console.log(target, target_name);
            // If a specific target is given, check if this channel is it before syncing
            if (target && target_name.toLowerCase() !== target.toLowerCase()) {
                return;
            }

            // Only sync data if it's not already subscribed
            if (target && client.isSubscribed(connection_id, target_name)) {
                return;
            }

            storage.getStateEvents(state.hash, target_name, function(events) {
                _.each(events, function(event, idx) {
                    client.sendIrcCommand(event[0], event[1]);
                });
            });
        });
    });
};

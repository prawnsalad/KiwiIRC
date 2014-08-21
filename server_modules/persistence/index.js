/**
 * Persistent IRC connections (BNC mode)
 */

var kiwiModules = require('../../server/modules'),
    _ = require('lodash'),
    Promise = require('es6-promise').Promise,
    storage, storage_engine;


// Create a storage engine, default being memory
if (global.config.persistence && global.config.persistence.storage) {
    storage_engine = global.config.persistence.storage;
} else {
    storage_engine = 'new_memory';
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
        var target = state.targetFromEvent(data.event, data.connection);
        var connection_id = data.connection.con_num;

        // Only store certain event types (types the user will be visually interested in)
        var allowed_events = ['message', 'topic', 'mode', 'channel', 'quit'];
        if (allowed_events.indexOf(data.event[0]) === -1)
            return;

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

        storage.putEvent(state_id, connection_id, target, data.event);
    });
}


// Populate a state with connection info from storage
function populateState(state, user_id) {
    state.closeAllConnections();

    storage.getUserConnections(user_id).then(function(connections) {
        _.each(connections, function(con) {
            var user = {hostname:'127.0.0.1', address:'127.0.0.1'},
                options = {connection_id: con.connection_id};

            state.connect(con.host, con.port, con.ssl, con.nick, user, options, function(){});
        });
    });
}


module.on('client created', function(event, event_data) {
    console.log('Adding persistent RPC methods');
    event_data.client.rpc.on('kiwi.session_save', _.bind(rpc_commands.sessionSave, event_data.client));
    event_data.client.rpc.on('kiwi.session_resume', _.bind(rpc_commands.sessionResume, event_data.client));
    event_data.client.rpc.on('kiwi.session_events', _.bind(rpc_commands.sessionEvents, event_data.client));
    event_data.client.rpc.on('kiwi.session_unsubscribe', _.bind(rpc_commands.sessionUnsubscribe, event_data.client));
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
        storage.getUserState(auth.user_id).then(function(state_id) {
            var state = global.states.getState(state_id);

            if (state) {
                state.save_state = false;
                state.dispose();
                state = null;
            }

            storage.setUserState(auth.user_id, that.state.hash).then(function() {
                that.state.save_state = true;

                handleEvents(that.state);
                callback(null, 'Sate will now persist');
            });
        });
    });
};

rpc_commands.sessionResume = function(client_callback, event_data) {
    var that = this,
        auth = {};

    auth.credentials = {
        username: event_data.username,
        password: event_data.password,
    };

    global.modules.emit('auth attempt', auth)
    .done(function() {
        if (!auth.success) {
            client_callback('invalid_auth');
            return;
        }

        storage.getUserState(auth.user_id).then(function(state_id) {
            var connections = [],
                connections_map = {},
                state = global.states.getState(state_id);

            if (!state) {
                // State doesn't exist so add the connections on to this state
                state = that.state;

                populateState(that.state, auth.user_id);

            } else {
                if (that.state) {
                    that.state.dispose();
                    that.state = state;
                }

                state.addClient(that);
            }

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
                    targets: []
                };

                _.each(irc_connection.irc_channels, function(chan, chan_name) {
                    connection.targets.push({
                        name: chan_name
                    });
                });

                connections_map[connection.connection_id] = connection;
                connections.push(connection);
            });


            // Second - get any targets held in storage (queries, etc)
            var promise = new Promise(function(resolve, reject) {
                var connections_processed = 0;

                // Loop through each target and make sure it's in the targets array we're sending to the browser
                var addTargetsCallback = function(connection_id, targets) {
                    _.each(targets, function(target_name) {
                        var target = _.find(connections_map[connection_id].targets, {name: target_name});
                        console.log('Adding target', target_name, (!target));
                        if (!target) {
                            connections_map[connection_id].targets.push({name: target_name});
                        }
                    });

                    // If this is the last connection, proceed to the next promise step
                    if (connections_processed === state.irc_connections.length-1) {
                        return resolve();
                    }

                    connections_processed++;
                };

                // Loop through each connection and get its targets. Calls the above callback
                _.each(state.irc_connections, function(irc_connection) {
                    if (!irc_connection)
                        return;

                    storage.getTargets(state.hash, irc_connection.con_num).then(function(targets) {
                        console.log('targets', targets);
                        addTargetsCallback(irc_connection.con_num, targets);
                    });
                });
            });

            // Third - Send all the data to the client
            promise.then(function() {
console.log('step 3', connections);
                // Send the connection information to the client
                client_callback(null, connections);

                // Second loop - Now the client has the info, sync some data
                _.each(state.irc_connections, function(irc_connection) {
                    if (!irc_connection)
                        return;

                    // Get a fresh MOTD sent to the client
                    irc_connection.write('MOTD');
                });
            });
        });
    });
};


rpc_commands.sessionEvents = function(callback, event_data) {
    var connection_id = event_data.connection_id,
        target = event_data.target,
        state = this.state,
        client = this,
        target_just_subscribed = {};

    var connection = _.find(state.irc_connections, {con_num: connection_id});

    if (!connection) {
        console.log('connection not found', connection_id);
        return callback('connection_not_found');
    }
console.log('connection found', connection_id);

    if (!client.isSubscribed(connection_id, target)) {
        // Subscribe the client to events to this connection/target
        client.subscribe(connection_id, target);

        target_just_subscribed[target] = true;
    }

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
    storage.getTargets(state.hash, connection_id).then(function(targets) {
console.log('targets:', targets);
        // Send each targets events down to the client
        _.each(targets, function(target_name) {
            console.log(target, target_name);
            // If a specific target is given, check if this channel is it before syncing
            if (target && target_name.toLowerCase() !== target.toLowerCase()) {
                return;
            }

            // Only sync data if it's not already subscribed
            if (target && !target_just_subscribed[target]) {
                return;
            }

            storage.getEvents(state.hash, connection_id, target_name, 0,0).then(function(events) {
                _.each(events, function(event, idx) {
                    client.sendIrcCommand(event[0], event[1]);
                });
            });
        });
    });
};


rpc_commands.sessionUnsubscribe = function(callback, event_data) {
    var client = this,
        state = this.state,
        connection_id = event_data.connection_id,
        target = event_data.target,
        connection;

    connection = _.find(state.irc_connections, {con_num: connection_id});
    if (!connection) {
        console.log('unsubscribing connection not found', connection_id);
        return callback('connection_not_found');
    }
console.log('Unsubscribing', connection_id, target);
    client.unsubscribe(connection_id, target);
    return callback(null);
};

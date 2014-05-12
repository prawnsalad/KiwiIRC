/**
 * Persistent IRC connections (BNC mode)
 */

var kiwiModules = require('../../server/modules'),
    _ = require('lodash'),
    express = require('express'),
    express_app = express(),
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
        var allowed_events = ['msg', 'notice', 'topic', 'action', 'mode', 'join', 'part', 'kick', 'quit'];
        if (allowed_events.indexOf(data.event[0]) === -1)
            return;

        if (data.event[1].target) {
            target = data.event[1].target;
        } else if(data.event[1].channel) {
            target = data.event[1].channel;
        }

        // If channel joining/parting does not involve us, don't store it.
        var special_events = ['join', 'part', 'kick', 'quit'];
        if (special_events.indexOf(data.event[0]) !== -1) {
            if (data.event[0] == 'kick' && data.event[1].kicked.toLowerCase() !== data.connection.nick.toLowerCase()) {
                return;
            } else if (data.event[1].nick.toLowerCase() !== data.connection.nick.toLowerCase()) {
                return;
            }
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
        username, password;

    username = event_data.username;
    password = event_data.password;

    // If this user already has a state, kill and replace it
    storage.getUserState(username, password, function(state) {
        if (state) {
            state.save_state = false;
            state.dispose();
            state = null;
        }

        storage.setUserState(username, password, that.state, function() {
            that.state.save_state = true;

            handleEvents(that.state);
            callback(null, 'Sate will now persist');
        });
    });
};

rpc_commands.sessionResume = function(callback, event_data) {
    var that = this,
        username, password,
        connections = [];

    username = event_data.username;
    password = event_data.password;

    storage.getUserState(username, password, function(state) {
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
        that.sendKiwiCommand('connection_sync', connections);

        // Second loop - Now the client has the info, sync some data
        _.each(state.irc_connections, function(irc_connection) {
            if (!irc_connection)
                return;

            // Get a fresh MOTD sent to the client
            irc_connection.write('MOTD');

            _.each(irc_connection.irc_channels, function(chan, chan_name) {
                chan.refreshNickList();
                chan.refreshTopic();
            });
        });
    });
};


rpc_commands.sessionEvents = function(event, event_data) {
    var connection_id = event_data.connection_id,
        target = event_data.target,
        state = this.state,
        client = this;

    var connection = _.find(state.irc_connections, {con_num: connection_id});

    if (connection) {

        _.each(connection.irc_channels, function(chan, chan_name) {
            // If a specific target is given, check if this channel is it before syncing
            if (target && chan_name.toLowerCase() !== target.toLowerCase()) {
                return;
            }

            // Only sync data if it's not already subscribed
            if (client.isSubscribed(connection_id, chan_name)) {
                return;
            }

            chan.refreshNickList();
            chan.refreshTopic();

            storage.getStateEvents(state.hash, chan_name, function(events) {
                _.each(events, function(event, idx) {
                    client.sendIrcCommand(event[0], event[1]);
                });
            });

            client.subscribe(connection_id, chan_name);
        });
    }
};


/*
module.on('http request', function (event, event_data) {
    express_app(event_data.request, event_data.response, function(){
        console.log(arguments);
    });
    //event.wait = true;
});
*/




express_app.get('/something', function(req, res) {
    res.send('Hello, this is something');
});
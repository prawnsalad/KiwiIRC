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


/**
 * Store events for a state that are sent to the client for persistence
 */
function handleEvents(state) {
    var state_id = state.hash;

    state.on('client_event', function(type, args) {
        if (type !== 'irc')
            return;

        // Only store certain event types (types the user will be visually interested in)
        var allowed_events = ['msg', 'notice', 'topic', 'action', 'mode', 'join', 'part', 'kick', 'quit'];
        if (allowed_events.indexOf(args.event[0]) === -1)
            return;


        // TODO: Find a way to get the IrcConnection object this event relates to
        // If channel joining/parting does not involve us, don't store it.
        var special_events = ['join', 'part', 'kick', 'quit'];
        if (special_events.indexOf(args.event[0]) !== -1) {
            if (args.event[0] == 'kick' && args[1].kicked !== THE_CONNECTION.nick) {
                return;
            } else if (args[1].nick !== THE_CONNECTION.nick) {
                return;
            }
        }

        storage.putStateEvent(state_id, args.event);
    });
}





module.on('client command kiwi', function(event, event_data) {
    var username, password;

    switch(event_data.command.command){
        case 'session_save':
            event.preventDefault();

            username = event_data.command.username;
            password = event_data.command.password;

            // If this user already has a state, kill and replace it
            storage.getUserState(username, password, function(state) {
                if (state) {
                    state.save_state = false;
                    state.dispose();
                    state = null;
                }

                storage.setUserState(username, password, event_data.client.state, function() {
                    event_data.client.state.save_state = true;

                    handleEvents(event_data.client.state);
                    event_data.callback(null, 'Sate will now persist');
                });
            });

            break;

        case 'session_resume':
            var connections = [];

            event.preventDefault();

            username = event_data.command.username;
            password = event_data.command.password;

            storage.getUserState(username, password, function(state) {
                if (!state) {
                    event_data.callback('does_not_exist');
                    return;
                }

                if (event_data.client.state)
                    event_data.client.state.dispose();

                state.addClient(event_data.client);
                event_data.client.state = state;

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
                event_data.client.sendKiwiCommand('connection_sync', connections);

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

                    // Send any persisted events we have
                    storage.getStateEvents(state.hash, function(events) {
                        if (!events)
                            return;

                        _.each(events, function(event, idx) {
                            event_data.client.sendIrcCommand(event[0], event[1]);
                        });
                    });
                });
            });


            break;
    }
});


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
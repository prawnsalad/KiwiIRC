/**
 * Persistent IRC connections (BNC mode)
 */

var kiwiModules = require('../server/modules'),
    express = require('express'),
    express_app = express();

// TODO: Add password hashing (username:password:salt)
var StorageMemory = function() {
    this.user_states = {};
};
StorageMemory.prototype.userExists = function(username, callback) {
    callback(!!(this.user_states[username]));
};
StorageMemory.prototype.getUserState = function(username, password, callback) {
    var user, state;

    // Check if this user exists
    if (!this.user_states[username])
        return callback(false);

    user = this.user_states[username];

    if (user.password !== password)
        return callback(false);

    state = global.states.getState(user.state_id);
    if (!state)
        return callback(false);

    user.last_used = new Date();

    return callback(state);
};
StorageMemory.prototype.setUserState = function(username, password, state, callback) {
    this.user_states[username] = this.user_states[username] || {};
    var user = this.user_states[username];

    user.username = username;
    user.password = password;
    user.last_used = new Date();
    user.state_id = state.hash;

    callback();
};



var storage = new StorageMemory();

var module = new kiwiModules.Module('persistence');

module.on('client created', function (event, event_data) {
    var client = event_data.client;

    client.on('dispose', function() {
        // Clean up
    });
});


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
                }

                storage.setUserState(username, password, event_data.client.state, function() {
                    event_data.client.state.save_state = true;

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

                    connections.push({
                        connection_id: irc_connection.con_num,
                        options: irc_connection.server.cache.options || {},
                        nick: irc_connection.nick,
                        address: irc_connection.irc_host.hostname,
                        port: irc_connection.irc_host.port,
                        ssl: irc_connection.ssl
                    });
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
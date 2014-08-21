var _ = require('lodash'),
    Promise = require('es6-promise').Promise;


var StorageMemory = module.exports = function StorageMemory() {
    this.user_state = {};  // {state_hash: user_id}
    this.users = {};  // {user_id: {state_id:'', connections:[]}}
};

/*
    users =  {
        state_id: 'state_id',
        connections: [
            {connection_id, host, port, events:{target:[], target1:[]}},
            {connection_id, host, port, events:{target:[], target1:[]}}
        ]
    }
*/

// Return a state_id or false if it does not exist
StorageMemory.prototype.getUserState = function(user_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        if (!that.users[user_id]) {
            return resolve();
        }

        resolve(that.users[user_id].state_id);
    });
};

StorageMemory.prototype.setUserState = function(user_id, state_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var existing_state_id;

        if (that.users[user_id]) {
            // Remove the existing state
            existing_state_id = that.users[user_id].state_id;
            delete that.user_state[that.users[user_id].state_id];

            // Add the new state_id
            that.users[user_id].state_id = state_id;
            that.user_state[state_id] = user_id;

        } else {
            that.users[user_id] = {
                state_id: state_id,
                connections: []
            };
            that.user_state[state_id] = user_id;
        }

        resolve();
    });
};


// Return an array of objects, each with connection info
//[
//  {con_id:0, host:'irc.host.com', port:111, nick:'sum'},
//  {con_id:1, host:'irc.host2.com', port:111, nick:'sum'}
//]
StorageMemory.prototype.getUserConnections = function(user_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        if (!that.user_state[state_id]) {
            return resolve(false);
        }

        var user = that.users[that.user_state[state_id]];

        var cons = [];
        user.connections.forEach(function(con) {
            cons.push({
                connection_id: con.id,
                host: con.host,
                port: con.port,
                ssl: con.ssl,
                nick: con.nick,
                gecos: con.gecos
            });
        });

        resolve(cons);
    });
};


// Return array of client events. If length < 0, get previous events
StorageMemory.prototype.getEvents = function(state_id, connection_id, target_name, from_time, length) {
    var that = this;

    return new Promise(function(resolve, reject) {
        if (!that.user_state[state_id]) {
            return resolve(false);
        }

        var user = that.users[that.user_state[state_id]];

        var con = _.find(user.connections, {connection_id: connection_id});
        if (!con) {
            return resolve(false);
        }

        var target = con.events[target_name];
        if (!target) {
            return resolve(false);
        }

        var idx, events = [];
        for(idx=0; idx<length, idx<target.length; idx++) {
            events.unshift(target[target.length-1-idx]);
        }

        resolve(events);
    });
};


StorageMemory.prototype.putEvent = function(state_id, connection_id, target_name, event) {
    var that = this;

    return new Promise(function(resolve, reject) {
        if (!that.user_state[state_id]) {
    console.log('putEvent() couldnt find state', state_id);
            return resolve(false);
        }

        var user = that.users[that.user_state[state_id]];

        var con = _.find(user.connections, {connection_id: connection_id});
        if (!con) {
    console.log('putEvent() couldnt find connection. creating one', connection_id);
            con = {connection_id: connection_id, events:{}};
            user.connections.push(con);
        }

        var target = con.events[target_name];
        if (!target) {
            target = con.events[target_name] = [];
        }
    console.log('Adding event', target_name, event);
        target.push(event);

        if (target.length > 50) {
            target.shift();
        }

        resolve();
    });
};


StorageMemory.prototype.getTargets = function(state_id, connection_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        if (!that.user_state[state_id]) {
            console.log('getTargets() state doesnt exist');
            return resolve(false);
        }

        var user = that.users[that.user_state[state_id]];
        var con = _.find(user.connections, {connection_id: connection_id});

        if (!con) {
            console.log('getTargets() connection doesnt exist', user.connections);
            return resolve(false);
        }

        var targets = _.keys(con.events);
        resolve(targets);
    });
};

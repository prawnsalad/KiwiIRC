var _ = require('lodash');


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
StorageMemory.prototype.getUserState = function(user_id, callback) {
	if (!this.users[user_id]) {
		return callback(false);
	}

    return callback(this.users[user_id].state_id);
};

StorageMemory.prototype.setUserState = function(user_id, state_id, callback) {
	var existing_state_id;

	if (this.users[user_id]) {
		// Remove the existing state
		existing_state_id = this.users[user_id].state_id;
		delete this.user_state[this.users[user_id].state_id];

		// Add the new state_id
		this.users[user_id].state_id = state_id;
		this.user_state[state_id] = user_id;

	} else {
		this.users[user_id] = {
			state_id: state_id,
			connections: []
		};
		this.user_state[state_id] = user_id;
	}

	callback();
};


// Return an array of objects, each with connection info
//[
//	{con_id:0, host:'irc.host.com', port:111, nick:'sum'},
//	{con_id:1, host:'irc.host2.com', port:111, nick:'sum'}
//]
StorageMemory.prototype.getUserConnections = function(user_id, callback) {
	if (!this.user_state[state_id]) {
		callback(false);
	}

	var user = this.users[this.user_state[state_id]];

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

	callback(cons);
};


// Return array of client events. If length < 0, get previous events
StorageMemory.prototype.getEvents = function(state_id, connection_id, target_name, from_time, length, callback) {
	if (!this.user_state[state_id]) {
		return callback(false);
	}

	var user = this.users[this.user_state[state_id]];

	var con = _.find(user.connections, {connection_id: connection_id});
	if (!con) {
		return callback(false);
	}

	var target = con.events[target_name];
	if (!target) {
		return callback(false);
	}

	var idx, events = [];
	for(idx=0; idx<length, idx<target.length; idx++) {
		events.push(target[target.length-1-idx]);
	}

	callback(events);
};


StorageMemory.prototype.putEvent = function(state_id, connection_id, target_name, event, callback) {
	if (!this.user_state[state_id]) {
console.log('putEvent() couldnt find state', state_id);
		return callback && callback(false);
	}

	var user = this.users[this.user_state[state_id]];

	var con = _.find(user.connections, {connection_id: connection_id});
	if (!con) {
console.log('putEvent() couldnt find connection', connection_id);
		con = {connection_id: connection_id, events:{}};
		user.connections.push(con);
		//return callback && callback(false);
	}

	var target = con.events[target_name];
	if (!target) {
		target = con.events[target_name] = [];
	}
console.log('Adding event', target_name, event);
	target.push(event);
};


StorageMemory.prototype.getTargets = function(state_id, connection_id, callback) {
	if (!this.user_state[state_id]) {
		return callback(false);
	}

	var user = this.users[this.user_state[state_id]];
	var con = _.find(user.connections, {connection_id: connection_id});

	if (!con) {
		return callback(false);
	}

	var targets = _.keys(con.events);
	callback(targets);
};

// TODO: Add password hashing (username:password:salt)


var StorageMemory = module.exports = function StorageMemory() {
    this.user_states = {};
    this.state_map = {};
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
    user.events = {};

    this.state_map[state.hash] = username;
    callback();
};


StorageMemory.prototype.putStateEvent = function(state_id, target, event, callback) {
    if (!this.state_map[state_id])
        return callback();

    var username = this.state_map[state_id],
        user = this.user_states[username];

    target = target.toLowerCase();

    user.events[target] = user.events[target] || [];
    user.events[target].push(event);
console.log('added event for', target, event);
    // Trim the events down to the latest 50 only
    if (user.events[target].length > 50)
        user.events[target].shift();

    return callback ? callback() : null;
};


StorageMemory.prototype.getStateEvents = function(state_id, target, callback) {
    if (!this.state_map[state_id])
        return callback(false);

    var username = this.state_map[state_id],
        user = this.user_states[username];

    return callback(user.events[target.toLowerCase()] || []);
};


StorageMemory.prototype.getTargets = function(state_id, callback) {
    if (!this.state_map[state_id])
        return callback(false);

    var username = this.state_map[state_id],
        user = this.user_states[username];
console.log(username, user);

    var targets = Object.keys(user.events);
    return callback(targets || []);
};

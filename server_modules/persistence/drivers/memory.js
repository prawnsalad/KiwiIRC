
var StorageMemory = module.exports = function StorageMemory() {
    this.user_states = {};
    this.state_map = {};
};


StorageMemory.prototype.userExists = function(user_id, callback) {
    callback(!!(this.user_states[user_id]));
};


StorageMemory.prototype.getUserState = function(user_id, callback) {
    var user, state;

    // Check if this user exists
    if (!this.user_states[user_id])
        return callback(false);

    user = this.user_states[user_id];

    state = global.states.getState(user.state_id);
    if (!state)
        return callback(false);

    user.last_used = new Date();

    return callback(state);
};


StorageMemory.prototype.setUserState = function(user_id, state, callback) {
    this.user_states[user_id] = this.user_states[user_id] || {};
    var user = this.user_states[user_id];

    user.user_id = user_id;
    user.last_used = new Date();
    user.state_id = state.hash;
    user.events = {};

    this.state_map[state.hash] = user_id;
    callback();
};


StorageMemory.prototype.putStateEvent = function(state_id, target, event, callback) {
    if (!this.state_map[state_id])
        return callback();

    var user_id = this.state_map[state_id],
        user = this.user_states[user_id];

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

    var user_id = this.state_map[state_id],
        user = this.user_states[user_id];

    return callback(user.events[target.toLowerCase()] || []);
};


StorageMemory.prototype.getTargets = function(state_id, callback) {
    if (!this.state_map[state_id])
        return callback(false);

    var user_id = this.state_map[state_id],
        user = this.user_states[user_id];
console.log(user_id, user);

    var targets = Object.keys(user.events);
    return callback(targets || []);
};

var redis = require('redis');

var RedisStore = module.exports.Store = function() {
    this._client = redis.createClient();
};


RedisStore.prototype.get = function(name, callback) {
    // No callback? No good getting anything then
    if (typeof callback !== 'function')
        return;

    this._client.get(name, function (err, reply) {
        callback(null, reply);
    });
};


RedisStore.prototype.set = function(name, val, callback) {
    this._client.set(name, val.toString());

    if (typeof callback === 'function')
        callback(null);
};


RedisStore.prototype.del = function(name, callback) {
    this._client.del(name);

    if (typeof callback === 'function')
        callback(null);
};
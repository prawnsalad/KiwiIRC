var MemoryStore = module.exports.Store = function() {
    this._data = new Object(null);
};


MemoryStore.prototype.get = function(name, callback) {
    if (typeof callback === 'function')
        callback(null, this._data[name]);
};


MemoryStore.prototype.set = function(name, val, callback) {
    this._data[name] = val;

    if (typeof callback === 'function')
        callback(null);
};


MemoryStore.prototype.del = function(name, callback) {
    delete this._data[name];

    if (typeof callback === 'function')
        callback(null);
};
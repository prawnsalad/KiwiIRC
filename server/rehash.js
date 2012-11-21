var util   = require('util'),
    events = require('events'),
    _      = require('lodash');



function Rehash() {}
util.inherits(Rehash, events.EventEmitter);

Rehash.prototype.rehashAll = function () {
    var files = [
        './client.js',
        './clientcommands.js',
        //'./configuration.js',
        './httphandler.js',
        './irc/commands.js',
        './irc/connection.js',
        './weblistener.js'
    ];
    
    _.each(files, function (file) {
        delete require.cache[require.resolve(file)];
        require(file);
    });

    this.emit('rehashed', [files]);
};



module.exports = new Rehash();
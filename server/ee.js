var util            = require('util'),
    EventEmitter2   = require('eventemitter2').EventEmitter2;


var EE = function() {
    EventEmitter2.apply(this, arguments);
};
util.inherits(EE, EventEmitter2);


EE.prototype.emit = function() {
    arguments[0] = arguments[0].toLowerCase();
    EventEmitter2.prototype.emit.apply(this, arguments);
};


EE.prototype.on = function() {
    arguments[0] = arguments[0].toLowerCase();
    EventEmitter2.prototype.on.apply(this, arguments);
};


module.exports = EE;
var kiwiModules = require('../server/modules');

var module = new kiwiModules.Module('Example Module');


module.on('client:connected', function(event, data) {
    console.log('Client connection:', data);
});


module.on('client:commands:msg', function(event, data) {
    console.log('Client msg:', data.args.target, ': ', data.args.msg);
    data.args.msg += ' - modified!';
});
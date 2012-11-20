var kiwiModules = require('../server/modules');

var module = new kiwiModules.Module('Example Module');


module.subscribe('client:connected', function(data) {
    console.log('Client connection:', data);
});


module.subscribe('client:commands:msg', function(data) {
    console.log('Client msg:', data.args.target, ': ', data.args.msg);
    data.args.msg += ' - modified!';
});
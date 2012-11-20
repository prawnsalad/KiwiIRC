var kiwiPlugins = require('../server/plugins.js');

var plugin = new kiwiPlugins.Plugin('Example Plugin');


plugin.subscribe('client:connected', function(data) {
	console.log('Client connection:', data);
});


plugin.subscribe('client:commands:msg', function(data) {
	console.log('Client msg:', data.args.target, ': ', data.args.msg);
	data.args.msg += ' - modified!';
});
/**
 * Server debugging via node-webkit-agent
 * https://github.com/c4milo/node-webkit-agent
 *
 * Requires npm module: webkit-devtools-agent
 */


var kiwiModules = require('../server/modules'),
	agent = require('webkit-devtools-agent');


var module = new kiwiModules.Module('web_agent_debugger');

agent.start();

console.log('Debugging can be accessed via http://c4milo.github.io/node-webkit-agent/26.0.1410.65/inspector.html?host=localhost:9999&page=0');

module.on('dispose', function() {
	agent.stop();
});
/**
 * Server debugging via node-webkit-agent
 * https://github.com/c4milo/node-webkit-agent
 *
 * Requires npm module: webkit-devtools-agent
 */

var path = require('path');

function initModule(KiwiModule, server_dir) {
    var agent = require('webkit-devtools-agent'),
        debugger_module = new KiwiModule('web_agent_debugger');

    agent.start({
        port: 9999,
        bind_to: '0.0.0.0',
        ipc_port: 3333,
        verbose: true
    });

    console.log('Debugging can be accessed via http://c4milo.github.io/node-webkit-agent/26.0.1410.65/inspector.html?host=localhost:9999&page=0');

    module.on('dispose', function() {
        agent.stop();
    });
}

module.exports = initModule;

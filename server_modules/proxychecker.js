/**
 * Open proxy checking
 *
 * Look for common open proxy ports from the client
 */

var util = require('util'),
    path = require('path'),
    net  = require('net');

function initModule(server_dir) {
    var kiwiModules = require(path.join(server_dir, 'modules.js')),
        proxychecker_module = new kiwiModules.Module('proxychecker'),
        client_addr = event_data.connection.state.client.websocket.meta.real_address;

    event.wait = true;

    proxychecker_module.on('irc connecting', function (event, event_data) {
        checkForOpenProxies(client_addr, function(is_proxy, host, port) {
            var err;
            if (is_proxy) {
                err = new Error(util.format('Proxy detected on %s:%d', client_addr, port));
                err.code = 'Blocked proxy';

                event_data.connection.emit('error', err);
                event.preventDefault();
                event.callback();

            } else {
                event.callback();
            }
        });
    });
}

module.exports = initModule;

function checkForOpenProxies(host, callback) {
    var ports = [80,8080,81,1080,6588,8000];
    var ports_completed = 0;

    var callback_called = false;

    var portFailed = function() {
        ports_completed++;
        this.removeAllListeners();
        this.destroy();

        if (!callback_called && ports_completed >= ports.length) {
            callback_called = true;
            callback(false);
        }
    };

    var portConnected = function() {
        var remote_port = this.remotePort;

        ports_completed++;
        this.removeAllListeners();
        this.destroy();

        if (!callback_called) {
            callback_called = true;
            callback(true, host, remote_port);
        }
    };

    var portTimeout = function() {
        ports_completed++;
        this.removeAllListeners();
        this.destroy();

        if (!callback_called && ports_completed >= ports.length) {
            callback_called = true;
            callback(false);
        }
    };

    for (var idx=0; idx< ports.length; idx++) {
        net.connect({port: ports[idx], host: host})
            .on('connect', portConnected)
            .on('error', portFailed)
            .on('close', portFailed)
            .on('timeout', portTimeout)
            .setTimeout(5000);
    }
}

var fs          = require('fs'),
    _           = require('underscore'),
    WebListener = require('./weblistener.js'),
    config      = require('./configuration.js'),
    rehash      = require('./rehash.js');





config.loadConfig();

// Make sure we have a valid config file and at least 1 server
if (Object.keys(config.get()).length === 0) {
    console.log('Couldn\'t find a valid config file!');
    process.exit(1);
}

if ((!config.get().servers) || (config.get().servers.length < 1)) {
    console.log('No servers defined in config file');
    process.exit(2);
}





/*
 * Web listeners
 */

// Holder for all the connected clients
// TODO: Change from an array to an object. Generate sha1 hash within the client
// and use that as the key. (Much less work involved in removing a client)
var clients = [];

// Start up a weblistener for each found in the config
_.each(config.get().servers, function (server) {
    var wl = new WebListener(server, config.get().transports);
    wl.on('connection', function (client) {
        clients.push(client);
    });
    wl.on('destroy', function (client) {
        clients = _.reject(clients, function (c) {
            return client === c;
        });
    });
});





/*
 * Process settings
 */

// Set process title
process.title = 'kiwiirc';

// Change UID/GID
if ((config.get().user) && (config.get().user !== '')) {
    process.setuid(config.user);
}
if ((config.get().group) && (config.get().group !== '')) {
    process.setgid(config.group);
}



/*
 * Listen for runtime commands
 */

process.stdin.resume();
process.stdin.on('data', function (buffered) {
    var data = buffered.toString().trim();

    switch (data) {
        case 'stats':
            console.log('Connected clients: ' + _.size(clients).toString());
            break;

        case 'reconfig':
            (function () {
                if (config.loadConfig()) {
                    console.log('New config file loaded');
                } else {
                    console.log("No new config file was loaded");
                }
            })();

            break;


        case 'rehash':
            (function () {
                rehash.rehashAll();
                console.log('Rehashed');
            })();

            break;

        default:
            console.log('Unrecognised command: ' + data);
    }
});

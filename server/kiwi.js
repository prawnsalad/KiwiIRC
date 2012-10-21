var fs          = require('fs'),
    _           = require('underscore'),
    WebListener = require('./weblistener.js');



/*
 * Config loading
 */

var config_filename = 'config.js',
    config_dirs = ['/etc/kiwiirc/', __dirname + '/'];

var config;

function loadConfig() {
    var new_config,
        conf_filepath;

    // Loop through the possible config paths and find a usable one
    for (var i in config_dirs) {
        conf_filepath = config_dirs[i] + config_filename;

        try {
            if (fs.lstatSync(conf_filepath).isFile() === true) {
                // Clear the loaded config cache
                delete require.cache[require.resolve(conf_filepath)];

                // Try load the new config file
                new_config = require(conf_filepath).production;
                console.log('Loaded config file ' + config_dirs[i] + config_filename);
                break;
            }
        } catch (e) {
            switch (e.code) {
            case 'ENOENT':      // No file/dir
                break;
            default:
                console.log('An error occured parsing the config file ' + config_dirs[i] + config_filename + ': ' + e.message);
                return false;
            }
            continue;
        }
    }

    return new_config;
}


config = loadConfig() || Object.create(null);

// Make sure we have a valid config file and at least 1 server
if (Object.keys(config).length === 0) {
    console.log('Couldn\'t find a valid config file!');
    process.exit(1);
}

if ((!config.servers) || (config.servers.length < 1)) {
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
_.each(config.servers, function (server) {
    var wl = new WebListener(server, config.transports);
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
if ((config.user) && (config.user !== '')) {
    process.setuid(config.user);
}
if ((config.group) && (config.group !== '')) {
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
                var new_conf = loadConfig();
                if (new_conf) {
                    config = new_conf;
                    console.log('New config file loaded');
                } else {
                    console.log("No new config file was loaded");
                }
            })();

            break;

        default:
            console.log('Unrecognised command: ' + data);
    }
});

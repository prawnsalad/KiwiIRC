var fs          = require('fs'),
    _           = require('underscore'),
    WebListener = require('./weblistener.js'),
    config      = require('./configuration.js'),
    rehash      = require('./rehash.js');



process.chdir(__dirname + '/../');
config.loadConfig();


// If we're not running in the forground and we have a log file.. switch
// console.log to output to a file
if (process.argv.indexOf('-f') === -1 && config.get().log) {
    (function () {
        var log_file_name = config.get().log;

        if (log_file_name[0] !== '/') {
            log_file_name = __dirname + '/../' + log_file_name;
        }



        console.log = function() {
            var logfile = fs.openSync(log_file_name, 'a'),
                out;

            out = Array.prototype.join.apply(arguments, [' ']);

            // Make sure we out somthing to log and we have an open file
            if (!out || !logfile) return;

            out += '\n';
            fs.writeSync(logfile, out, null);

            fs.closeSync(logfile);
        };
    })();
}



// Make sure we have a valid config file and at least 1 server
if (Object.keys(config.get()).length === 0) {
    console.log('Couldn\'t find a valid config file!');
    process.exit(1);
}

if ((!config.get().servers) || (config.get().servers.length < 1)) {
    console.log('No servers defined in config file');
    process.exit(2);
}





// Holder for all the connected clients
global.clients = {
    clients: Object.create(null),
    addresses: Object.create(null),

    add: function (client) {
        this.clients[client.hash] = client;
        if (typeof this.addresses[client.real_address] === 'undefined') {
            this.addresses[client.real_address] = Object.create(null);
        }
        this.addresses[client.real_address][client.hash] = client;
    },

    remove: function (client) {
        if (typeof this.clients[client.hash] !== 'undefined') {
            delete this.clients[client.hash];
            delete this.addresses[client.real_address][client.hash];
            if (Object.keys(this.addresses[client.real_address]).length < 1) {
                delete this.addresses[client.real_address];
            }
        }
    },

    numOnAddress: function (addr) {
        if (typeof this.addresses[addr] !== 'undefined') {
            return Object.keys(this.addresses[addr]).length;
        } else {
            return 0;
        }
    }
};




/*
 * Web listeners
 */


// Start up a weblistener for each found in the config
_.each(config.get().servers, function (server) {
    var wl = new WebListener(server, config.get().transports);
    
    wl.on('connection', function (client) {
        clients.add(client);
    });

    wl.on('destroy', function (client) {
        clients.remove(client);
    });
});





/*
 * Process settings
 */

// Set process title
process.title = 'kiwiirc';

// Change UID/GID
if ((config.get().group) && (config.get().group !== '')) {
    process.setgid(config.get().group);
}
if ((config.get().user) && (config.get().user !== '')) {
    process.setuid(config.get().user);
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

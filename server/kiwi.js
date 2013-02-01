var fs          = require('fs'),
    _           = require('lodash'),
    WebListener = require('./weblistener.js'),
    config      = require('./configuration.js'),
    rehash      = require('./rehash.js'),
    modules     = require('./modules.js');



process.chdir(__dirname + '/../');
config.loadConfig();


// If we're not running in the forground and we have a log file.. switch
// console.log to output to a file
if (process.argv.indexOf('-f') === -1 && global.config.log) {
    (function () {
        var log_file_name = global.config.log;

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
if (!global.config || Object.keys(global.config).length === 0) {
    console.log('Couldn\'t find a valid config.js file (Did you copy the config.example.js file yet?)');
    process.exit(1);
}

if ((!global.config.servers) || (global.config.servers.length < 1)) {
    console.log('No servers defined in config file');
    process.exit(2);
}




// Create a plugin interface
global.modules = new modules.Publisher();

// Register as the active interface
modules.registerPublisher(global.modules);

// Load any modules in the config
if (global.config.module_dir) {
    (global.config.modules || []).forEach(function (module_name) {
        if (modules.load(global.config.module_dir + module_name + '.js')) {
            console.log('Module ' + module_name + ' loaded successfuly');
        } else {
            console.log('Module ' + module_name + ' failed to load');
        }
    });
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
_.each(global.config.servers, function (server) {
    var wl = new WebListener(server, global.config.transports);

    wl.on('connection', function (client) {
        clients.add(client);
    });

    wl.on('client_dispose', function (client) {
        clients.remove(client);
    });

    wl.on('listening', webListenerRunning);
});

// Once all the listeners are listening, set the processes UID/GID
var num_listening = 0;
function webListenerRunning() {
    num_listening++;
    if (num_listening === global.config.servers.length) {
        setProcessUid();
    }
}




/*
 * Process settings
 */

// Set process title
process.title = 'kiwiirc';

// Change UID/GID
function setProcessUid() {
    if ((global.config.group) && (global.config.group !== '')) {
        process.setgid(global.config.group);
    }
    if ((global.config.user) && (global.config.user !== '')) {
        process.setuid(global.config.user);
    }
}


// Make sure Kiwi doesn't simply quit on an exception
process.on('uncaughtException', function (e) {
    console.log('[Uncaught exception] ' + e);
    console.log(e.stack);
});


process.on('SIGUSR1', function() {
    if (config.loadConfig()) {
        console.log('New config file loaded');
    } else {
        console.log("No new config file was loaded");
    }
});




/*
 * Listen for runtime commands
 */

process.stdin.resume();
process.stdin.on('data', function (buffered) {
    var data = buffered.toString().trim();

    switch (data) {
        case 'stats':
            console.log('Connected clients: ' + _.size(global.clients.clients).toString());
            console.log('Num. remote hosts: ' + _.size(global.clients.addresses).toString());
            break;

        case 'reconfig':
            if (config.loadConfig()) {
                console.log('New config file loaded');
            } else {
                console.log("No new config file was loaded");
            }

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

var fs          = require('fs'),
    _           = require('lodash'),
    util        = require('util'),
    WebListener = require('./weblistener.js'),
    config      = require('./configuration.js'),
    modules     = require('./modules.js'),
    Identd      = require('./identd.js'),
    Proxy       = require('./proxy.js'),
    ControlInterface = require('./controlinterface.js');



process.chdir(__dirname + '/../');

(function (argv) {
    var conf_switch = argv.indexOf('-c');
    if (conf_switch !== -1) {
        if (argv[conf_switch + 1]) {
            return config.loadConfig(argv[conf_switch + 1]);
        }
    }

    config.loadConfig();

})(process.argv);


// If we're not running in the forground and we have a log file.. switch
// console.log to output to a file
if (process.argv.indexOf('-f') === -1 && global.config && global.config.log) {
    (function () {
        var log_file_name = global.config.log;

        if (log_file_name[0] !== '/') {
            log_file_name = __dirname + '/../' + log_file_name;
        }



        console.log = function() {
            var logfile = fs.openSync(log_file_name, 'a'),
                out;

            out = util.format.apply(util, arguments);

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
        if (modules.load(module_name)) {
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

    // Local and foriegn port pairs for identd lookups
    // {'65483_6667': client_obj, '54356_6697': client_obj}
    port_pairs: {},

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
    },

    broadcastKiwiCommand: function (command, data, callback) {
        var clients = [];

        // Get an array of clients for us to work with
        for (var client in global.clients.clients) {
            clients.push(global.clients.clients[client]);
        }


        // Sending of the command in batches
        var sendCommandBatch = function (list) {
            var batch_size = 100,
                cutoff;

            if (list.length >= batch_size) {
                // If we have more clients than our batch size, call ourself with the next batch
                setTimeout(function () {
                    sendCommandBatch(list.slice(batch_size));
                }, 200);

                cutoff = batch_size;

            } else {
                cutoff = list.length;
            }

            list.slice(0, cutoff).forEach(function (client) {
                if (!client.disposed) {
                    client.sendKiwiCommand(command, data);
                }
            });

            if (cutoff === list.length && typeof callback === 'function') {
                callback();
            }
        };

        sendCommandBatch(clients);
    }
};

global.servers = {
    servers: Object.create(null),

    addConnection: function (connection) {
        var host = connection.irc_host.hostname;
        if (!this.servers[host]) {
            this.servers[host] = [];
        }
        this.servers[host].push(connection);
    },

    removeConnection: function (connection) {
        var host = connection.irc_host.hostname
        if (this.servers[host]) {
            this.servers[host] = _.without(this.servers[host], connection);
            if (this.servers[host].length === 0) {
                delete this.servers[host];
            }
        }
    },

    numOnHost: function (host) {
        if (this.servers[host]) {
            return this.servers[host].length;
        } else {
            return 0;
        }
    }
};



/**
 * When a new config is loaded, send out an alert to the clients so
 * so they can reload it
 */
config.on('loaded', function () {
    global.clients.broadcastKiwiCommand('reconfig');
});



/*
 * Identd server
 */
if (global.config.identd && global.config.identd.enabled) {
    var identd_resolve_user = function(port_here, port_there) {
        var key = port_here.toString() + '_' + port_there.toString();

        if (typeof global.clients.port_pairs[key] == 'undefined') {
            return;
        }

        return global.clients.port_pairs[key].username;
    };

    var identd_server = new Identd({
        bind_addr: global.config.identd.address,
        bind_port: global.config.identd.port,
        user_id: identd_resolve_user
    });

    identd_server.start();
}




/*
 * Web listeners
 */


// Start up a weblistener for each found in the config
_.each(global.config.servers, function (server) {
    if (server.type == 'proxy') {
        // Start up a kiwi proxy server
        var serv = new Proxy.ProxyServer();
        serv.listen(server.port, server.address, server);

        serv.on('listening', function() {
            console.log('Kiwi proxy listening on %s:%s %s SSL', server.address, server.port, (server.ssl ? 'with' : 'without'));
        });

        serv.on('socket_connected', function(pipe) {
            // SSL connections have the raw socket as a property
            var socket = pipe.irc_socket.socket ?
                    pipe.irc_socket.socket :
                    pipe.irc_socket;

            pipe.identd_pair = socket.localPort.toString() + '_' + socket.remotePort.toString();
            global.clients.port_pairs[pipe.identd_pair] = pipe.meta;
        });

        serv.on('connection_close', function(pipe) {
            delete global.clients.port_pairs[pipe.identd_pair];
        });

    } else {
        // Start up a kiwi web server
        var wl = new WebListener(server, global.config.transports);

        wl.on('connection', function (client) {
            clients.add(client);
        });

        wl.on('client_dispose', function (client) {
            clients.remove(client);
        });

        wl.on('listening', function () {
            console.log('Listening on %s:%s %s SSL', server.address, server.port, (server.ssl ? 'with' : 'without'));
            webListenerRunning();
        });

        wl.on('error', function (err) {
            console.log('Error listening on %s:%s: %s', server.address, server.port, err.code);
            // TODO: This should probably be refactored. ^JA
            webListenerRunning();
        });
    }
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


process.on('SIGUSR2', function() {
    console.log('Connected clients: ' + _.size(global.clients.clients).toString());
    console.log('Num. remote hosts: ' + _.size(global.clients.addresses).toString());
});


/*
 * Listen for runtime commands
 */
process.stdin.resume();
new ControlInterface(process.stdin, process.stdout, {prompt: ''});

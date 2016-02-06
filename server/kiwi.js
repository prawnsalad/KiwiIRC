var _           = require('lodash'),
    winston     = require('winston'),
    WebListener = require('./weblistener.js'),
    config      = require('./configuration.js'),
    modules     = require('./modules.js'),
    Identd      = require('./identd.js'),
    Proxy       = require('./proxy.js'),
    ControlInterface = require('./controlinterface.js'),
    configLoader = require('./helpers/configloader.js');


process.title = 'kiwiirc';
process.chdir(__dirname + '/../');
global.build_version = require('../package.json').version;

configLoader()
    .then(checkConfig)
    .then(initLogging)
    .then(initModules)
    .then(initGlobalStores)
    .then(initIdentd)
    .then(initWebListeners)
    .then(setProcessUserGroup)
    .then(initProcessHandlers)
    .then(listenForUserInput)
    .catch(function(err) {
        process.exit(1);
    });


function checkConfig() {
    // Make sure we have a valid config file and at least 1 server
    if (!global.config || Object.keys(global.config).length === 0) {
        winston.error('Couldn\'t find a valid config.js file (Did you copy the config.example.js file yet?)');
        process.exit(1);
    }

    if ((!global.config.servers) || (global.config.servers.length < 1)) {
        winston.error('No servers defined in config file');
        process.exit(2);
    }

    /**
     * When a new config is loaded, send out an alert to the clients so
     * so they can reload it
     */
    config.on('loaded', function () {
        global.clients.broadcastKiwiCommand('reconfig');
    });
}


function initLogging() {
    // Extra debugging output if the -v flag is given
    if (process.argv.indexOf('-v') > -1) {
        winston.level = 'debug';
    }

    // If we're running in the foreground or we don't have a log file config, don't output to a file
    if (process.argv.indexOf('-f') > -1 || !(global.config && global.config.log)) {
        return;
    }

    var log_file_name = global.config.resolvePath(global.config.log);

    winston.add(winston.transports.File, {
        filename: log_file_name,
        json: false,
        timestamp: function() {
            var year, month, day, time_string,
                d = new Date();

            year = String(d.getFullYear());
            month = String(d.getMonth() + 1);
            if (month.length === 1) {
                month = "0" + month;
            }

            day = String(d.getDate());
            if (day.length === 1) {
                day = "0" + day;
            }

            // Take the time from the existing toTimeString() format
            time_string = (new Date()).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");

            return year + "-" + month + "-" + day + ' ' + time_string;
        }
    });

    winston.remove(winston.transports.Console);
}


function initModules() {
    // Create a plugin interface
    global.modules = new modules.Publisher();

    // Register as the active interface
    modules.registerPublisher(global.modules);

    // Load any modules in the config
    if (global.config.module_dir) {
        (global.config.modules || []).forEach(function (module_name) {
            if (modules.load(module_name)) {
                winston.info('Module %s loaded successfully', module_name);
            } else {
                winston.warn('Module %s failed to load', module_name);
            }
        });
    }
}


function initGlobalStores() {
    // Holder for all the connected clients
    global.clients = {
        clients: Object.create(null),
        addresses: Object.create(null),

        // Local and foriegn port pairs for identd lookups
        // {'65483_6667': client_obj, '54356_6697': client_obj}
        port_pairs: {},

        add: function (client) {
            this.clients[client.id] = client;
            if (typeof this.addresses[client.real_address] === 'undefined') {
                this.addresses[client.real_address] = Object.create(null);
            }
            this.addresses[client.real_address][client.id] = client;
        },

        remove: function (client) {
            if (typeof this.clients[client.id] !== 'undefined') {
                delete this.clients[client.id];
                delete this.addresses[client.real_address][client.id];
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
            var host = connection.irc_host.hostname;
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
}







/*
 * Identd server
 */
function initIdentd() {
    if (!global.config.identd || !global.config.identd.enabled) {
        return;
    }

    var identd_resolve_user = function(port_here, port_there) {
        var key = port_here.toString() + '_' + port_there.toString();

        if (typeof global.clients.port_pairs[key] === 'undefined') {
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
function initWebListeners() {
    var promises = [];

    // Start up a weblistener for each found in the config
    _.each(global.config.servers, function (server_config) {
        var server = _.extend({}, server_config);

        // Make sure any paths are relative to the config file
        ['ssl_key', 'ssl_cert', 'ssl_ca'].forEach(function(key) {
            if (!server[key]) return;

            if (typeof server[key] === 'string') {
                server[key] = global.config.resolvePath(server[key]);
            } else if (_.isArray(server[key])) {
                server[key] = server[key].map(function(item) {
                    return global.config.resolvePath(item);
                });
            }
        });

        if (server.type == 'proxy') {
            // Start up a kiwi proxy server
            var serv = new Proxy.ProxyServer();

            try {
                serv.listen(server.port, server.address, server);
            } catch (err) {
                winston.info('Error starting proxy on %s:%s: %s', server.address, server.port, err.code);
                return;
            }

            serv.on('listening', function() {
                winston.info('Kiwi proxy listening on %s:%s %s SSL', server.address, server.port, (server.ssl ? 'with' : 'without'));
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
            promises.push(new Promise(function (resolve, reject) {
                var wl = new WebListener(server, global.config.transports);

                wl.on('connection', function (client) {
                    clients.add(client);
                });

                wl.on('client_dispose', function (client) {
                    clients.remove(client);
                });

                wl.on('listening', function () {
                    winston.info('Listening on %s:%s %s SSL', server.address, server.port, (server.ssl ? 'with' : 'without'));
                    resolve();
                });

                wl.on('error', function (err) {
                    winston.info('Error listening on %s:%s: %s', server.address, server.port, err.code);
                    // TODO: This should probably be refactored. ^JA
                    resolve();
                });
            }));
        }
    });

    return Promise.all(promises);
}


function setProcessUserGroup() {
    // Change UID/GID
    if ((global.config.group) && (global.config.group !== '')) {
        process.setgid(global.config.group);
    }
    if ((global.config.user) && (global.config.user !== '')) {
        process.setuid(global.config.user);
    }
}


function initProcessHandlers() {
    // Make sure Kiwi doesn't simply quit on an exception
    process.on('uncaughtException', function (e) {
        winston.error('[Uncaught exception] %s', e, {stack: e.stack});
    });


    process.on('SIGUSR1', function() {
        if (config.loadConfig()) {
            winston.info('New config file loaded');
        } else {
            winston.info('No new config file was loaded');
        }
    });


    process.on('SIGUSR2', function() {
        winston.info('Connected clients: %s', _.size(global.clients.clients));
        winston.info('Num. remote hosts: %s', _.size(global.clients.addresses));
    });
}

/*
 * Listen for runtime commands
 */
function listenForUserInput() {
    process.stdin.resume();
    new ControlInterface(process.stdin, process.stdout, {prompt: ''});
}

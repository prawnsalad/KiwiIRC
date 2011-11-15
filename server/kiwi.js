/*jslint continue: true, forin: true, regexp: true, undef: false, node: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
"use strict";
var tls = require('tls'),
    net = require('net'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    url = require('url'),
    dns = require('dns'),
    crypto = require('crypto'),
    events = require("events"),
    util = require('util'),
    ws = require('socket.io'),
    jsp = require("uglify-js").parser,
    pro = require("uglify-js").uglify,
    _ = require('./lib/underscore.min.js'),
    starttls = require('./lib/starttls.js'),
    app = require(__dirname + '/app.js');


// Libraries may need to know kiwi.js path as __dirname
// only gives that librarys path. Set it here for usage later.
this.kiwi_root = __dirname;



// How to handle log output
this.log = function(str, level) {
    level = level || 0;
    console.log(str);
}


/*
 * Configuration and rehashing routines
 */
var config_filename = 'config.json',
    config_dirs = ['/etc/kiwiirc/', this.kiwi_root + '/'];

this.config = {};
this.loadConfig = function () {
    var i, j,
        nconf = {},
        cconf = {},
        found_config = false;
    
    for (i in config_dirs) {
        try {
            if (fs.lstatSync(config_dirs[i] + config_filename).isDirectory() === false) {
                found_config = true;
                nconf = JSON.parse(fs.readFileSync(config_dirs[i] + config_filename, 'ascii'));
                for (j in nconf) {
                    // If this has changed from the previous config, mark it as changed
                    if (!_.isEqual(this.config[j], nconf[j])) {
                        cconf[j] = nconf[j];
                    }

                    this.config[j] = nconf[j];
                }

                this.log('Loaded config file ' + config_dirs[i] + config_filename);
                break;
            }
        } catch (e) {
            switch (e.code) {
            case 'ENOENT':      // No file/dir
                break;
            default:
                this.log('An error occured parsing the config file ' + config_dirs[i] + config_filename + ': ' + e.message);
                return false;
            }
            continue;
        }
    }
    if (Object.keys(this.config).length === 0) {
        if (!found_config) {
            this.log('Couldn\'t find a config file!');
        }
        return false;
    }
    return [nconf, cconf];
};


// Reloads the config during runtime
this.rehash = function () {
    return app.rehash();
}

// Reloads app.js during runtime for any recoding
this.recode = function () {
    if (typeof require.cache[this.kiwi_root + '/app.js'] !== 'undefined'){
        delete require.cache[this.kiwi_root + '/app.js'];
    }

    app = null;
    app = require(__dirname + '/app.js');

    var objs = {tls:tls, net:net, http:http, https:https, fs:fs, url:url, dns:dns, crypto:crypto, events:events, util:util, ws:ws, jsp:jsp, pro:pro, _:_, starttls:starttls};
    app.init(objs);

    return true;
}






/*
 * Before we continue we need the config loaded
 */
if (!this.loadConfig()) {
    process.exit(0);
}







/*
 * HTTP file serving
 */
if (this.config.handle_http) {
    this.fileServer = new (require('node-static').Server)(__dirname + this.config.public_http);
    this.jade = require('jade');
    this.cache = {alljs: '', html: []};
}
this.httpServers = [];
this.httpHandler = function (request, response) {
    return app.httpHandler(request, response);
}






/*
 * Websocket handling
 */
this.connections = {};
this.io = [];
this.websocketListen = function (servers, handler) {
    return app.websocketListen(servers, handler);
}
this.websocketConnection = function (websocket) {
    return app.websocketConnection(websocket);
}
this.websocketDisconnect = function () {
    return app.websocketDisconnect(this);
}
this.websocketMessage = function (msg, callback) {
    return app.websocketMessage(this, msg, callback);
}
this.websocketIRCConnect = function (nick, host, port, ssl, callback) {
    return app.websocketIRCConnect(this, nick, host, port, ssl, callback);
}




/*
 * IRC handling
 */
this.parseIRCMessage = function (websocket, ircSocket, data) {
    return app.parseIRCMessage(websocket, ircSocket, data);
}
this.ircSocketDataHandler = function (data, websocket, ircSocket) {
    return app.ircSocketDataHandler(data, websocket, ircSocket);
}
this.IRCConnection = function (websocket, nick, host, port, ssl, password, callback) {
    return app.IRCConnection.call(this, websocket, nick, host, port, ssl, password, callback);
}
util.inherits(this.IRCConnection, events.EventEmitter);
this.bindIRCCommands = function (irc_connection, websocket) {
    return app.bindIRCCommands.call(this, irc_connection, websocket);
}







/*
 * Load up main application source
 */
if (!this.recode()) {
    process.exit(0);
}



// Set the process title
app.setTitle();



/*
 * Load the modules as set in the config and print them out
 */
this.kiwi_mod = require('./lib/kiwi_mod.js');
this.kiwi_mod.loadModules(this.kiwi_root, this.config);
this.kiwi_mod.printMods();


// Make sure Kiwi doesn't simply quit on an exception
/*process.on('uncaughtException', function (e) {
    console.log('[Uncaught exception] ' + e);
});*/

// Start the server up
this.websocketListen(this.config.servers, this.httpHandler);

// Now we're listening on the network, set our UID/GIDs if required
app.changeUser();

// Listen for controll messages
process.stdin.resume();
process.stdin.on('data', function (data) { app.manageControll(data); });





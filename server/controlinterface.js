var _           = require('lodash'),
    rehash      = require('./rehash.js'),
    config      = require('../server/configuration.js'),
    kiwiModules = require('../server/modules');



var ControlInterface = module.exports = function(stream_in, stream_out, opts) {
    stream_out = stream_out || stream_in;
    this.stream_out = stream_out;
    this.stream_in = stream_in;

    opts = opts || {};
    this.prompt = (typeof opts.prompt === 'string') ?
        opts.prompt :
        'Kiwi > ';

    this._custom_commands = {};

    this._onData = this.onData.bind(this);
    stream_in.on('data', this._onData);

    this.displayPrompt();
};



ControlInterface.prototype.dispose = function() {
    this.stream_in.removeListener('data', this._onData);
    this.stream_in = null;
    this.stream_out = null;
};



ControlInterface.prototype.write = function(data, append) {
    if (typeof append === 'undefined') append = '\n';
    try {
        this.stream_out.write(data + append);
    } catch(err){}
};



ControlInterface.prototype.displayPrompt = function(prompt) {
    prompt = prompt || this.prompt;
    this.write(prompt, '');
};



ControlInterface.prototype.onData = function(buffered) {
    var data = buffered.toString().trim(),
        data_parts = data.split(' '),
        cmd = data_parts[0] || null;

    if (typeof this._custom_commands[cmd] === 'function') {
        this._custom_commands[cmd].call(this, data_parts.slice(1), data);

    } else if (typeof commands[cmd] === 'function') {
        commands[cmd].call(this, data_parts.slice(1), data);

    } else {
        this.write('Unrecognised command: ' + cmd);
    }

    this.displayPrompt();
};



ControlInterface.prototype.addCommand = function(command, fn) {
    this._custom_commands[command] = fn;
};



var commands = {};
commands.stats = function(args, raw) {
    this.write('Connected clients: ' + _.size(global.clients.clients).toString());
    this.write('Num. remote hosts: ' + _.size(global.clients.addresses).toString());
};


commands.reconfig = function(args, raw) {
    if (config.loadConfig()) {
        console.log('New config file loaded');
    } else {
        console.log("No new config file was loaded");
    }
};


commands.rehash = function(args, raw) {
    rehash.rehashAll();
    console.log('Rehashed');
};


commands.jumpserver = function(args, raw) {
    var num_clients = _.size(global.clients.clients),
        packet = {}, args_idx;

    if (num_clients === 0) {
        console.log('No connected clients');
        return;
    }

    // For each word in the line minus the last, add it to the packet
    for(args_idx=0; args_idx<args.length-1; args_idx++){
        packet[args[args_idx]] = true;
    }

    packet.kiwi_server = args[args_idx];

    console.log('Broadcasting jumpserver to ' + num_clients.toString() + ' clients..');
    global.clients.broadcastKiwiCommand('jumpserver', packet, function() {
        console.log('Broadcast complete.');
    });
};


commands.module = function(args, raw) {
    switch(args[0]) {
        case 'reload':
            if (!args[1]) {
                this.write('A module name must be specified');
                return;
            }

            if (!kiwiModules.unload(args[1])) {
                this.write('Module ' + (args[1] || '') + ' is not loaded');
                return;
            }

            if (!kiwiModules.load(args[1])) {
                this.write('Error loading module ' + (args[1] || ''));
            }
            this.write('Module ' + args[1] + ' reloaded');

            break;

        case 'list':
        case 'ls':
        default:
            var module_names = [];
            kiwiModules.getRegisteredModules().forEach(function(module) {
                module_names.push(module.module_name);
            });
            this.write('Loaded modules: ' + module_names.join(', '));
    }
};


commands.hello = function(args, raw) {
    this.write('Hello, beautiful :)');
};

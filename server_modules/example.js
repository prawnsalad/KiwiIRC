var path = require('path');

function initModule(KiwiModule) {
    var example_module = new KiwiModule('Example Module');

    // A web client is connected
    example_module.on('client created', function(event, data) {
        console.log('[client connection]', data);
    });


    // The Client recieves a IRC PRIVMSG command
    example_module.on('irc message', function(event, data) {
        console.log('[MESSAGE]', data.irc_event);
    });

    // The Client recieves a IRC USER NOTICE command
    example_module.on('irc user notice', function(event, data) {
        console.log('[NOTICE]', data.irc_event);
    });

    // The client recieves an IRC JOIN command
    example_module.on('irc channel join', function(event, data) {
        console.log('[JOIN]', data.irc_event);
    });


    // A command has been sent from the client
    example_module.on('client command', function(event, data) {
        var client_method = data.command.method;
        var client_args = data.command.args;

        console.log('[CLIENT COMMAND]', client_method);
        console.log('    ', client_args);
    });
}

module.exports = initModule;

/**
 * DNS Blacklist support
 *
 * Check the client against a blacklist before connection to an IRC server
 */

var dns = require('dns'),
    kiwiModules = require('../server/modules');


// The available DNS zones to check against
var bl_zones = {
    dronebl: '.dnsbl.dronebl.org'
};

// The DNS zone we should use
var current_bl = 'dronebl';


var module = new kiwiModules.Module('DNSBL');

module.on('irc connecting', function (event, event_data) {
    event.wait = true;

    var client_addr = event_data.connection.state.client.websocket.handshake.real_address;

    isBlacklisted(client_addr, function(is_blocked) {
        if (is_blocked) {
            var err = new Error('DNSBL blocked (' + client_addr + ')');
            err.code = 'Blacklisted';

            event_data.connection.emit('error', err);
            event.preventDefault();
            event.callback();

        } else {
            event.callback();
        }
    });
});



// The actual checking against the DNS blacklist
function isBlacklisted(ip, callback) {
    var host_lookup = reverseIp(ip) + bl_zones[current_bl];

    dns.resolve4(host_lookup, function(err, domain) {
        if (err) {
            // Not blacklisted
            callback(false);
        } else {
            // It is blacklisted
            callback(true);
        }
    });
}


function reverseIp(ip) {
    return ip.split('.').reverse().join('.');
}
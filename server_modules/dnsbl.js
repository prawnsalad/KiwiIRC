/**
 * DNS Blacklist support
 *
 * Check the client against a blacklist before connection to an IRC server
 */

var dns = require('dns'),
    path = require('path');

// The available DNS zones to check against
var bl_zones = {
    dronebl: '.dnsbl.dronebl.org'
};

// The DNS zone we should use
var current_bl = 'dronebl';

function initModule(server_dir) {
    var kiwiModules = require(path.join(server_dir, 'modules.js')),
    dnsbl_module = new kiwiModules.Module('DNSBL');

    dnsbl_module.on('irc connecting', function (event, event_data) {
        var client_addr = event_data.connection.state.client.websocket.meta.real_address;

        event.wait = true;

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
}

module.exports = initModule;

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
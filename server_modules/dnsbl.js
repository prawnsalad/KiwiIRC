/**
 * DNS Blacklist support. (Requires Node.js >= v4.x)
 *
 *   You can set DNSBL zones in the config file under: conf.dnsbl.zones
 *   Default: 'dnsbl.dronebl.org', 'rbl.efnetrbl.org', 'tor.dnsbl.sectoor.de'
 *   Example:
 *       conf.dnsbl = {
 *           zones: ['dnsbl.dronebl.org', 'rbl.efnetrbl.org', 'tor.dnsbl.sectoor.de', 'socks.dnsbl.sorbs.net']
 *       };
 *
 * Check the client against a blacklist before connection to an IRC server.
 */
var dns = require('dns'),
    util = require('util'),
    kiwiModules = require('../server/modules'),
    module = new kiwiModules.Module('DNSBL'),
    config = require('../config');

try {
   var zones = config.production.dnsbl.zones;
 } catch (e) {
   var zones = null;
}
module.on('irc connecting', function (event, event_data) {
    event.wait = true;
    new DNSBL(zones).scan(event_data.connection.state.client.websocket.meta.real_address).then(function (res) {
        var err = new Error(util.format('DNSBL blocked (%s) on (%s)', res.ip, res.zone));
        err.code = 'Blacklisted';
        event_data.connection.emit('error', err);
        event.preventDefault();
        event.callback();
     }).catch(function (ip) {
        event.callback();
    });
});

/*
 *  This is a basic DNSBL scanner. This is Promise based,
 *  which means it requires Node.js v4.x or higher.
 */
function DNSBL (zones) {
         this.zones = (Array.isArray(zones) ? zones : false) || [
             'dnsbl.dronebl.org',
             'rbl.efnetrbl.org',
             'tor.dnsbl.sectoor.de'
         ];
         this.finished = 0;
         return this;
}
DNSBL.prototype.scan = function (ip) {
         var rip = ip.split('.').reverse().join('.');
         return new Promise((function (parent) {
             return function (resolve, reject) {
                 parent.zones.forEach(function (zone) {
                     dns.resolve4(util.format('%s.%s', rip, zone), function (err, addrs) {
                         if (Array.isArray(addrs) && !!addrs.length) {
                            resolve({ ip: ip, reverse: rip, zone: zone.replace(/^\./,'') });
                          } else if (++parent.finished >= parent.zones.length) {
                            reject(ip);
                         }
                     });
                 });
             }
         })(this));
};

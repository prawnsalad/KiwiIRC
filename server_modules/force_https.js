/**
 * Force HTTPS
 *
 * Keep users secure by redirecting them to HTTPS if not already
 */

var kiwiModules = require('../server/modules');

var module = new kiwiModules.Module('force_https');


module.on('http request', function (event, event_data) {
    var req = event_data.request;
    var res = event_data.response;
    var is_https = !!req.connection.encrypted;

    if (!is_https) {
        event.preventDefault();
        res.writeHead(301, {Location: 'https://' + (req.headers.host.split(':')[0]) + req.url});
        res.end();
    }
});


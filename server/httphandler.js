var url         = require('url'),
    fs          = require('fs'),
    node_static = require('node-static'),
    _           = require('lodash');



var HttpHandler = function (config) {
    var public_html = config.public_html || 'client/';
    this.file_server = new node_static.Server(public_html);
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // The incoming requests base path (ie. /kiwiclient)
    var base_path = global.config.http_base_path || '/kiwi',
        base_path_regex;

    // Trim of any trailing slashes
    if (base_path.substr(base_path.length - 1) === '/') {
        base_path = base_path.substr(0, base_path.length - 1);
    }

    // Build the regex to match the base_path
    base_path_regex = base_path.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Any asset request to head into the asset dir
    request.url = request.url.replace(base_path + '/assets/', '/assets/');

    // Any requests for /client to load the index file
    if (request.url.match(new RegExp('^' + base_path_regex + '([/$]|$)', 'i'))) {
        request.url = '/';
    }

    // If the 'magic' translation is requested, figure out the best language to use from
    // the Accept-Language HTTP header. If nothing is suitible, serve an empty response,
    // Kiwi will just use the default en-gb strings baked in to it.
    if (request.url.substr(0, 16) === '/assets/locales/') {
        if (request.url === '/assets/locales/magic.json') {
            return serveMagicLocale.call(this, request, response);
        } else {
            response.setHeader('Content-Language', request.url.substr(16, request.url.indexOf('.') - 16));
        }
    }

    this.file_server.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};

var serveMagicLocale = function (request, response) {
    if (request.headers['accept-language']) {
        // Example: en-gb,en;q=0.5
        langs = request.headers['accept-language'].split(',');
        fs.readdir('client/assets/locales', function (err, files) {
            var available = [],
                i = 0,
                langs = [];

            files.forEach(function (file) {
                if (file.substr(-5) === '.json') {
                    available.push(file.slice(0, -5));
                }
            });

            for (i = 0; i < langs.length; i++) {
                langs[i]= langs[i].split(';q=');
                langs[i][1] = (typeof langs[i][1] === 'string') ? parseFloat(langs[i][1]) : 1.0;
            }
            langs.sort(function (a, b) {
                return b[1] - a[1];
            });
            for (i = 0; i < langs.length; i++) {
                if (langs[i][0] === '*') {
                    break;
                } else if (_.contains(available, langs[i][0])) {
                    return this.file_server.serveFile('/assets/locales/' + langs[i][0] + '.json', 200, {Vary: 'Accept-Language', 'Content-Language': langs[i][0]}, request, response);
                }
            }
            serveFallbackLocale(response);
        });
    } else {
        serveFallbackLocale(response);
    }
};

var serveFallbackLocale = function (response) {
    response.writeHead(200, {
        'Vary': 'Accept-Language',
        'Content-Type': 'application/json',
        'Content-Language': 'en-gb'
    });
    response.end('{"en-gb": {"":{}}}');
};

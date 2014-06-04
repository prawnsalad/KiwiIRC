var url         = require('url'),
    fs          = require('fs'),
    node_static = require('node-static'),
    Negotiator  = require('negotiator'),
    _           = require('lodash'),
    config      = require('./configuration.js'),
    SettingsGenerator = require('./settingsgenerator.js');




var HttpHandler = function (config) {
    var public_http = config.public_http || 'client/';
    this.file_server = new node_static.Server(public_http);
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // The incoming requests base path (ie. /kiwiclient)
    var base_path = global.config.http_base_path || '',
        whitelisted_folders = ['assets', 'src'];

    // Trim off any trailing slashes
    if (base_path.substr(base_path.length - 1) === '/') {
        base_path = base_path.substr(0, base_path.length - 1);
    }

    // Map any whitelisted folders to the local directories
    whitelisted_folders.forEach(function(folder) {
        request.url = request.url.replace(base_path + '/' + folder + '/', '/' + folder + '/');
    });

    // Any requests for /base_path/* to load the index file
    if (request.url.toLowerCase().indexOf(base_path.toLowerCase()) === 0) {
        request.url = '/index.html';
    }

    // If the 'magic' translation is requested, figure out the best language to use from
    // the Accept-Language HTTP header. If nothing is suitible, fallback to our en-gb default translation
    if (request.url.substr(0, 16) === '/assets/locales/') {
        if (request.url === '/assets/locales/magic.json') {
            return serveMagicLocale.call(this, request, response);
        } else {
            response.setHeader('Content-Language', request.url.substr(16, request.url.indexOf('.') - 16));
        }
    } else if (request.url.substr(0, 21) === '/assets/settings.json') {
        return serveSettings.call(this, request, response);
    }

    this.file_server.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};


// Cached list of available translations
var cached_available_locales = [];

// Get a list of the available translations we have
fs.readdir('client/assets/locales', function (err, files) {
    files.forEach(function (file) {
        if (file.substr(-5) === '.json') {
            cached_available_locales.push(file.slice(0, -5));
        }
    });
});



/**
 * Handle the /assets/locales/magic.json request
 * Find the closest translation we have for the language
 * set in the browser.
 **/
var serveMagicLocale = function (request, response) {
    var default_locale_id = 'en-gb',
        found_locale, negotiator;

    if (!request.headers['accept-language']) {
        // No accept-language specified in the request so send the default
        found_locale = default_locale_id;

    } else {
        negotiator = new Negotiator(request);
        found_locale = negotiator.language(cached_available_locales);

        // If a locale couldn't be negotiated, use the default
        found_locale = found_locale || default_locale_id;
    }

    // Send a locale to the browser
    this.file_server.serveFile('/assets/locales/' + found_locale + '.json', 200, {
        Vary: 'Accept-Language',
        'Content-Language': found_locale
    }, request, response);
};



/**
 * Handle the settings.json request
 */
var serveSettings = function(request, response) {
    var referrer_url,
        debug = false,
        settings;

    // Check the referrer for a debug option
    if (request.headers['referer']) {
        referrer_url = url.parse(request.headers['referer'], true);
        if (referrer_url.query && referrer_url.query.debug) {
            debug = true;
        }
    }

    SettingsGenerator.get(debug, function(settings) {
        if (request.headers['if-none-match'] && request.headers['if-none-match'] === settings.hash) {
            response.writeHead(304, 'Not Modified');
            return response.end();
        }

        response.writeHead(200, {
            'ETag': settings.hash,
            'Content-Type': 'application/json'
        });
        response.end(settings.settings);
    });
};

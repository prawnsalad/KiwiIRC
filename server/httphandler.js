var url         = require('url'),
    fs          = require('fs'),
    node_static = require('node-static'),
    Negotiator  = require('negotiator'),
    winston     = require('winston'),
    SettingsGenerator = require('./settingsgenerator.js'),
    Stats       = require('./stats.js');



// Cached list of available translations
var cached_available_locales = null;



var HttpHandler = function (config) {
    var public_http = config.public_http || 'client/';
    this.file_server = new node_static.Server(public_http);

    if (!cached_available_locales) {
        updateLocalesCache();
    }
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // The incoming requests base path (ie. /kiwiclient)
    var base_path, base_check,
        whitelisted_folders = ['/assets', '/src'],
        is_whitelisted_folder = false;

    // Trim off any trailing slashes from the base_path
    base_path = global.config.http_base_path || '';
    if (base_path.substr(base_path.length - 1) === '/') {
        base_path = base_path.substr(0, base_path.length - 1);
    }

    // Normalise the URL + remove query strings to compare against the base_path
    base_check = request.url.split('?')[0];
    if (base_check.substr(base_check.length - 1) !== '/') {
        base_check += '/';
    }

    // Normalise the URL we use by removing the base path
    if (base_check.indexOf(base_path + '/') === 0) {
        request.url = request.url.replace(base_path, '');

    } else if (base_check !== '/') {
        // We don't handle requests outside of the base path and not /, so just 404
        response.writeHead(404);
        response.write('Not Found');
        response.end();
        return;
    }

    // Map any whitelisted folders to the local directories
    whitelisted_folders.forEach(function(folder) {
        if (request.url.indexOf(folder) === 0) {
            is_whitelisted_folder = true;
        }
    });

    // Any requests not for whitelisted assets returns the index page
    if (!is_whitelisted_folder) {
        request.url = '/index.html';
    }

    if (request.url === '/index.html') {
        Stats.incr('http.homepage');
    }

    if (global.config.headers) {
        for (var key in global.config.headers) {
            response.setHeader(key, global.config.headers[key]);
        }
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




/**
 * Cache the available locales we have so we don't read the same directory for each request
 **/
function updateLocalesCache() {
    cached_available_locales = [];

    fs.readdir(global.config.public_http + '/assets/locales', function (err, files) {
        if (err) {
            if (err.code === 'ENOENT') {
                winston.error('No locale files could be found at ' + err.path);
            } else {
                winston.error('Error reading locales.', err);
            }
        }

        (files || []).forEach(function (file) {
            if (file.substr(-5) === '.json') {
                cached_available_locales.push(file.slice(0, -5));
            }
        });
    });
}



/**
 * Handle the /assets/locales/magic.json request
 * Find the closest translation we have for the language
 * set in the browser.
 **/
function serveMagicLocale(request, response) {
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
}



/**
 * Handle the settings.json request
 */
function serveSettings(request, response) {
    var referrer_url,
        debug = false;

    // Check the referrer for a debug option
    if (request.headers.referer) {
        referrer_url = url.parse(request.headers.referer, true);
        if (referrer_url.query && referrer_url.query.debug) {
            debug = true;
        }
    }

    SettingsGenerator.get(debug, function(err, settings) {
        if (err) {
            winston.error('Error generating settings', err);
            response.writeHead(500, 'Internal Server Error');
            return response.end();
        }

        if (request.headers['if-none-match'] && request.headers['if-none-match'] === settings.hash) {
            response.writeHead(304, 'Not Modified');
            return response.end();
        }

        var head = {
            'ETag': settings.hash,
            'Content-Type': 'application/json'
        };

        if (global.config.headers) {
            for (var key in global.config.headers) {
                head[key] = global.config.headers[key];
            }
        }

        response.writeHead(200, head);
        response.end(settings.settings);
    });
}

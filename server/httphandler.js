var url         = require('url'),
    fs          = require('fs'),
    node_static = require('node-static'),
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

    // Any src request to head into the src dir
    request.url = request.url.replace(base_path + '/src/', '/src/');

    // Any requests for /client to load the index file
    if (request.url.match(new RegExp('^' + base_path_regex + '([/$]|$)', 'i'))) {
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

    // Catch POST and GET variables
    var url = require('url'),
        querystring = require('querystring'),
        data = '',
        post_data = {},
        get_data = {};

    if(request.method === "POST") {
        request.on("data", function(chunk) {
            data += chunk;
        });
        
        request.on("end", function() {
            post_data = querystring.parse(data);
            console.log('POST', post_data);
        });
    } else if (request.method === "GET" && request.url.match(/\?/g)) { // No time to waist if there's no querystring !
        data = url.parse(request.url, true);
        get_data = data.query;
        console.log('GET', get_data);
    }
};


/**
 * Handle the /assets/locales/magic.json request
 * Find the closest translation we have for the language
 * set in the browser.
 **/
var serveMagicLocale = function (request, response) {
    var that = this,
        default_locale_id = 'en-gb';

    if (!request.headers['accept-language']) {
        // No accept-language specified in the request so send the default
        return serveLocale.call(this, request, response, default_locale_id);
    }

    fs.readdir('client/assets/locales', function (err, files) {
        var available = [],
            i = 0,
            langs = request.headers['accept-language'].split(','), // Example: en-gb,en;q=0.5
            found_locale = default_locale_id;

        // Get a list of the available translations we have
        files.forEach(function (file) {
            if (file.substr(-5) === '.json') {
                available.push(file.slice(0, -5));
            }
        });

        // Sanitise the browsers accepted languages and the qualities
        for (i = 0; i < langs.length; i++) {
            langs[i]= langs[i].split(';q=');
            langs[i][0] = langs[i][0].toLowerCase();
            langs[i][1] = (typeof langs[i][1] === 'string') ? parseFloat(langs[i][1]) : 1.0;
        }

        // Sort the accepted languages by quality
        langs.sort(function (a, b) {
            return b[1] - a[1];
        });

        // Serve the first language we have a translation for
        for (i = 0; i < langs.length; i++) {
            if (langs[i][0] === '*') {
                break;
            } else if (_.contains(available, langs[i][0])) {
                found_locale = langs[i][0];
                break;
            }
        }

        return serveLocale.call(that, request, response, found_locale);
    });
};


/**
 * Send a locale to the browser
 */
var serveLocale = function (request, response, locale_id) {
    this.file_server.serveFile('/assets/locales/' + locale_id + '.json', 200, {
        Vary: 'Accept-Language',
        'Content-Language': locale_id
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

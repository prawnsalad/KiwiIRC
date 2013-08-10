var url         = require('url'),
    fs          = require('fs'),
    crypto      = require('crypto'),
    node_static = require('node-static'),
    _           = require('lodash'),
    config      = require('./configuration.js');



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

var serveMagicLocale = function (request, response) {
    var that = this;

    if (request.headers['accept-language']) {
        fs.readdir('client/assets/locales', function (err, files) {
            var available = [],
                i = 0,
                langs = request.headers['accept-language'].split(','); // Example: en-gb,en;q=0.5

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
                    return that.file_server.serveFile('/assets/locales/' + langs[i][0] + '.json', 200, {Vary: 'Accept-Language', 'Content-Language': langs[i][0]}, request, response);
                }
            }

            serveFallbackLocale.call(that, request, response);
        });
    } else {
        serveFallbackLocale.call(that, request, response);
    }
};

var serveFallbackLocale = function (request, response) {
    //en-gb is our default language, so we serve this as the last possible answer for everything
    this.file_server.serveFile('/assets/locales/en-gb.json', 200, {Vary: 'Accept-Language', 'Content-Language': 'en-gb'}, request, response);
};

var cached_settings = {
    hash: '',
    settings: ''
};

config.on('loaded', function () {
    cached_settings.settings = '';
    cached_settings.hash = '';
});

function generateSettings(request, callback) {
    var vars = {
            server_settings: {},
            client_plugins: [],
            translations: [],
            scripts: [
                [
                    'libs/lodash.min.js'
                ],
                'libs/backbone.min.js',
                'libs/jed.js'
            ]
        },
        referrer_url;

    if (request.headers['referer']) {
        referrer_url = url.parse(request.headers['referer'], true);
    }
    if (referrer_url && referrer_url.query && referrer_url.query.debug) {
        vars.scripts = vars.scripts.concat([
            'src/app.js',
            [
                'src/models/application.js',
                'src/models/gateway.js'
            ],
            [
                'src/models/newconnection.js',
                'src/models/panellist.js',
                'src/models/networkpanellist.js',
                'src/models/panel.js',
                'src/models/member.js',
                'src/models/memberlist.js',
                'src/models/network.js'
            ],
            
            [
                'src/models/query.js',
                'src/models/channel.js',
                'src/models/server.js',
                'src/models/applet.js'
            ],

            [
                'src/applets/settings.js',
                'src/applets/chanlist.js',
                'src/applets/scripteditor.js'
            ],

            [
                'src/models/pluginmanager.js',
                'src/models/datastore.js',
                'src/helpers/utils.js'
            ],

            // Some views extend these, so make sure they're loaded beforehand
            [
                'src/views/panel.js'
            ],

            [
                'src/views/channel.js',
                'src/views/applet.js',
                'src/views/application.js',
                'src/views/apptoolbar.js',
                'src/views/controlbox.js',
                'src/views/favicon.js',
                'src/views/mediamessage.js',
                'src/views/member.js',
                'src/views/memberlist.js',
                'src/views/menubox.js',
                'src/views/networktabs.js',
                'src/views/nickchangebox.js',
                'src/views/resizehandler.js',
                'src/views/serverselect.js',
                'src/views/statusmessage.js',
                'src/views/tabs.js',
                'src/views/topicbar.js',
                'src/views/userbox.js'
            ]
        ]);
    } else {
        vars.scripts.push('kiwi.min.js');
    }

    // Any restricted server mode set?
    if (config.get().restrict_server) {
        vars.server_settings = {
            connection: {
                server: config.get().restrict_server,
                port: config.get().restrict_server_port || 6667,
                ssl: config.get().restrict_server_ssl,
                channel: config.get().restrict_server_channel,
                nick: config.get().restrict_server_nick,
                allow_change: false
            }
        };
    }

    // Any client default settings?
    if (config.get().client) {
        vars.server_settings.client = config.get().client;
    }

    // Any client plugins?
    if (config.get().client_plugins && config.get().client_plugins.length > 0) {
        vars.client_plugins = config.get().client_plugins;
    }

    fs.readFile(__dirname + '/../client/assets/src/translations/translations.json', function (err, translations) {
        if (err) {
            return callback(err);
        }

        var translation_files;
        translations = JSON.parse(translations);
        fs.readdir(__dirname + '/../client/assets/src/translations/', function (err, pofiles) {
            var hash;
            if (err) {
                return callback(err);
            }

            pofiles.forEach(function (file) {
                var locale = file.slice(0, -3);
                if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                    vars.translations.push({tag: locale, language: translations[locale]});
                }
            });

            cached_settings.settings = JSON.stringify(vars);
            cached_settings.hash = crypto.createHash('md5').update(cached_settings.settings).digest('hex');

            return callback(null, cached_settings);
        });
    });
}

function serveSettings(request, response) {
    if (cached_settings.settings === '') {
        generateSettings(request, function (err, settings) {
            if (err) {
                response.statusCode = 500;
                response.end();
            } else {
                sendSettings.call(this, request, response, settings);
            }
        });
    } else {
        sendSettings.call(this, request, response, cached_settings);
    }
}

function sendSettings(request, response, settings) {
    if (request.headers['if-none-match'] && request.headers['if-none-match'] === settings.hash) {
        response.writeHead(304, 'Not Modified');
        return response.end();
    }

    response.writeHead(200, {
        'ETag': settings.hash,
        'Content-Type': 'application/json'
    });
    response.end(settings.settings);
}

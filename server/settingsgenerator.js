var fs          = require('fs'),
    crypto      = require('crypto'),
    config      = require('./configuration.js');


module.exports.generate = generateSettings;
module.exports.get = getSettings;


// Cache for settings.json
var cached_settings = {
    debug: {
        hash: '',
        settings: ''
    },
    production: {
        hash: '',
        settings: ''
    }
};

// Clear the settings cache when the settings change
config.on('loaded', function () {
    cached_settings.debug.settings = cached_settings.production.settings = '';
    cached_settings.debug.hash = cached_settings.production.hash = '';
});




function getSettings(debug, callback) {
    var settings = cached_settings[debug ? 'debug' : 'production'];

    var returnSettings = function() {
        callback(settings);
    };

    // Generate the settings if we don't have them cached as yet
    if (settings.settings === '') {
        generateSettings(debug, returnSettings);
    } else {
        returnSettings();
    }
}


/**
 * Generate a settings object for the client.
 * Settings include available translations, default client config, etc
 */
function generateSettings(debug, callback) {
    var vars = {
            server_settings: {},
            client_plugins: [],
            translations: [],
            scripts: [
                [
                    'assets/libs/lodash.min.js'
                ],
                ['assets/libs/backbone.min.js', 'assets/libs/jed.js']
            ]
        };

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

    addScripts(vars, debug);

    // Further jobs depend on callbacks, so tally up completed jobs before callback()
    var total_jobs = 2,
        completed_jobs = 0,
        jobComplete = function() {
            completed_jobs++;

            if (completed_jobs < total_jobs)
                return;

            settings = cached_settings[debug?'debug':'production'];
            settings.settings = JSON.stringify(vars);
            settings.hash = crypto.createHash('md5').update(settings.settings).digest('hex');

            callback();
        };

    addThemes(vars, jobComplete);
    addTranslations(vars, jobComplete);

}


function addThemes(vars, callback) {
    readThemeInfo(config.get().client_themes || ['relaxed'], function (err, themes) {
        if (err) {
            return callback(err);
        }

        vars.themes = themes;
        return callback();
    });
}


function readThemeInfo(themes, prev, callback) {
    "use strict";
    var theme = themes[0];

    if (typeof prev === 'function') {
        callback = prev;
        prev = [];
    }

    fs.readFile(__dirname + '/../client/assets/themes/' + theme.toLowerCase() + '/theme.json', function (err, theme_json) {
        if (err) {
            return callback(err);
        }

        try {
            theme_json = JSON.parse(theme_json);
        } catch (e) {
            return callback(e);
        }

        prev.push(theme_json);

        if (themes.length > 1) {
            return readThemeInfo(themes.slice(1), prev, callback);
        }

        callback(null, prev);
    });
}


function addTranslations(vars, callback) {
    // Get a list of available translations
    fs.readFile(__dirname + '/../client/src/translations/translations.json', function (err, translations) {
        if (err) {
            return callback(err);
        }

        translations = JSON.parse(translations);
        fs.readdir(__dirname + '/../client/src/translations/', function (err, pofiles) {
            if (err) {
                return callback(err);
            }

            pofiles.forEach(function (file) {
                var locale = file.slice(0, -3);
                if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                    vars.translations.push({tag: locale, language: translations[locale]});
                }
            });

            return callback();
        });
    });
}


function addScripts(vars, debug) {
    if (!debug) {
        vars.scripts.push(['assets/kiwi.min.js', 'assets/libs/engine.io.bundle.min.js']);
        return;
    }

    vars.scripts = vars.scripts.concat([
        [
            'src/app.js',
            'assets/libs/engine.io.js',
            'assets/libs/engine.io.tools.js'
        ],
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
            'src/models/network.js',
            'src/models/channelinfo.js'
        ],

        [
            'src/models/channel.js',
            'src/models/applet.js'
        ],

        [
            'src/models/query.js',
            'src/models/server.js',     // Depends on models/channel.js
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
            'src/views/userbox.js',
            'src/views/channeltools.js',
            'src/views/channelinfo.js',
            'src/views/texttheme.js'
        ]
    ]);
}
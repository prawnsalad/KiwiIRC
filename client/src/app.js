define(function (require, exports, module) {

var DataStore = require('./models/datastore');
var PluginManager = require('./models/pluginmanager');
var MediaMessage = require('./views/mediamessage');
var Application = require('./models/application');

var randomString = require('./helpers/utils').randomString;
var secondsToTime = require('./helpers/utils').secondsToTime;
var parseISO8601 = require('./helpers/utils').parseISO8601;
var escapeRegex = require('./helpers/utils').escapeRegex;
var formatIRCMsg = require('./helpers/utils').formatIRCMsg;
var styleText = require('./helpers/utils').styleText;
var hsl2rgb = require('./helpers/utils').hsl2rgb;

var _kiwi = {};

_kiwi.misc = {};
_kiwi.model = {};
_kiwi.view = {};
_kiwi.applets = {};


/**
 * A global container for third party access
 * Will be used to access a limited subset of kiwi functionality
 * and data (think: plugins)
 */
_kiwi.global = {
    build_version: '',  // Kiwi IRC version this is built from (Set from index.html)
    settings: undefined, // Instance of DataStore
    plugins: undefined, // Instance of PluginManager
    events: undefined, // Instance of PluginInterface
    utils: {}, // References to misc. re-usable helpers / functions

    initUtils: function() {
        this.utils.randomString = randomString;
        this.utils.secondsToTime = secondsToTime;
        this.utils.parseISO8601 = parseISO8601;
        this.utils.escapeRegex = escapeRegex;
        this.utils.formatIRCMsg = formatIRCMsg;
        this.utils.styleText = styleText;
        this.utils.hsl2rgb = hsl2rgb;
    },

    rpc: function() {
        _kiwi.gateway.rpc.call.call(_kiwi.gateway.rpc, arguments);
    },

    addMediaMessageType: function(match, buildHtml) {
        MediaMessage.addType(match, buildHtml);
    },

    // Event managers for plugins
    components: {
        EventComponent: function(event_source, proxy_event_name) {
            /*
             * proxyEvent() listens for events then re-triggers them on its own
             * event emitter. Why? So we can .off() on this emitter without
             * effecting the source of events. Handy for plugins that we don't
             * trust meddling with the core events.
             *
             * If listening for 'all' events the arguments are as follows:
             *     1. Name of the triggered event
             *     2. The event data
             * For all other events, we only have one argument:
             *     1. The event data
             *
             * When this is used via `new kiwi.components.Network()`, this listens
             * for 'all' events so the first argument is the event name which is
             * the connection ID. We don't want to re-trigger this event name so
             * we need to juggle the arguments to find the real event name we want
             * to emit.
             */
            function proxyEvent(event_name, event_data) {
                if (proxy_event_name == 'all') {
                    event_name = event_data.event_name;
                    event_data = event_data.event_data;
                } else {
                    event_data = event_name.event_data;
                    event_name = event_name.event_name;
                }

                this.trigger(event_name, event_data);
            }

            // The event we are to proxy
            proxy_event_name = proxy_event_name || 'all';


            _.extend(this, Backbone.Events);
            this._source = event_source;

            // Proxy the events to this dispatcher
            event_source.on(proxy_event_name, proxyEvent, this);

            // Clean up this object
            this.dispose = function () {
                event_source.off(proxy_event_name, proxyEvent);
                this.off();
                delete this.event_source;
            };
        },

        Network: function(connection_id) {
            var connection_event;

            if (typeof connection_id !== 'undefined') {
                connection_event = 'connection:' + connection_id.toString();
            } else {
                connection_event = 'connection';
            }

            var obj = new this.EventComponent(_kiwi.gateway, connection_event);
            var funcs = {
                kiwi: 'kiwi', raw: 'raw', kick: 'kick', topic: 'topic',
                part: 'part', join: 'join', action: 'action', ctcp: 'ctcp',
                ctcpRequest: 'ctcpRequest', ctcpResponse: 'ctcpResponse',
                notice: 'notice', msg: 'privmsg', changeNick: 'changeNick',
                channelInfo: 'channelInfo', mode: 'mode'
            };

            // Proxy each gateway method
            _.each(funcs, function(gateway_fn, func_name) {
                obj[func_name] = function() {
                    var fn_name = gateway_fn;

                    // Add connection_id to the argument list
                    var args = Array.prototype.slice.call(arguments, 0);
                    args.unshift(connection_id);

                    // Call the gateway function on behalf of this connection
                    return _kiwi.gateway[fn_name].apply(_kiwi.gateway, args);
                };
            });

            return obj;
        },

        ControlInput: function() {
            var obj = new this.EventComponent(_kiwi.app.controlbox);
            var funcs = {
                run: 'processInput', addPluginIcon: 'addPluginIcon'
            };

            _.each(funcs, function(controlbox_fn, func_name) {
                obj[func_name] = function() {
                    var fn_name = controlbox_fn;
                    return _kiwi.app.controlbox[fn_name].apply(_kiwi.app.controlbox, arguments);
                };
            });

            return obj;
        }
    },

    // Entry point to start the kiwi application
    init: function (opts, callback) {
        var jobs, locale, localeLoaded, textThemeLoaded, text_theme;
        opts = opts || {};

        this.initUtils();

        jobs = new JobManager();
        jobs.onFinish(function(locale, s, xhr) {
            console.log('Application', Application);
            _kiwi.app = new Application(opts);

            // Start the client up
            _kiwi.app.initializeInterfaces();

            // Event emitter to let plugins interface with parts of kiwi
            _kiwi.global.events  = new PluginInterface();

            // Now everything has started up, load the plugin manager for third party plugins
            _kiwi.global.plugins = new PluginManager();

            callback();
        });

        textThemeLoaded = function(text_theme, s, xhr) {
            opts.text_theme = text_theme;

            jobs.finishJob('load_text_theme');
        };

        localeLoaded = function(locale, s, xhr) {
            if (locale) {
                _kiwi.global.i18n = new Jed(locale);
            } else {
                _kiwi.global.i18n = new Jed();
            }

            jobs.finishJob('load_locale');
        };

        // Set up the settings datastore
        _kiwi.global.settings = DataStore.instance('kiwi.settings');
        _kiwi.global.settings.load();

        // Set the window title
        window.document.title = opts.server_settings.client.window_title || 'Kiwi IRC';

        jobs.registerJob('load_locale');
        locale = _kiwi.global.settings.get('locale');
        if (!locale) {
            $.getJSON(opts.base_path + '/assets/locales/magic.json', localeLoaded);
        } else {
            $.getJSON(opts.base_path + '/assets/locales/' + locale + '.json', localeLoaded);
        }

        jobs.registerJob('load_text_theme');
        text_theme = opts.server_settings.client.settings.text_theme || 'default';
        $.getJSON(opts.base_path + '/assets/text_themes/' + text_theme + '.json', textThemeLoaded);
    },

    start: function() {
        _kiwi.app.showStartup();
    },

    // Allow plugins to change the startup applet
    registerStartupApplet: function(startup_applet_name) {
        _kiwi.app.startup_applet_name = startup_applet_name;
    },

    /**
     * Open a new IRC connection
     * @param {Object} connection_details {nick, host, port, ssl, password, options}
     * @param {Function} callback function(err, network){}
     */
    newIrcConnection: function(connection_details, callback) {
        _kiwi.gateway.newConnection(connection_details, callback);
    },


    /**
     * Taking settings from the server and URL, extract the default server/channel/nick settings
     */
    defaultServerSettings: function () {
        var parts;
        var defaults = {
            nick: '',
            server: '',
            port: 6667,
            ssl: false,
            channel: '',
            channel_key: ''
        };
        var uricheck;


        /**
         * Get any settings set by the server
         * These settings may be changed in the server selection dialog or via URL parameters
         */
        if (_kiwi.app.server_settings.client) {
            if (_kiwi.app.server_settings.client.nick)
                defaults.nick = _kiwi.app.server_settings.client.nick;

            if (_kiwi.app.server_settings.client.server)
                defaults.server = _kiwi.app.server_settings.client.server;

            if (_kiwi.app.server_settings.client.port)
                defaults.port = _kiwi.app.server_settings.client.port;

            if (_kiwi.app.server_settings.client.ssl)
                defaults.ssl = _kiwi.app.server_settings.client.ssl;

            if (_kiwi.app.server_settings.client.channel)
                defaults.channel = _kiwi.app.server_settings.client.channel;

            if (_kiwi.app.server_settings.client.channel_key)
                defaults.channel_key = _kiwi.app.server_settings.client.channel_key;
        }



        /**
         * Get any settings passed in the URL
         * These settings may be changed in the server selection dialog
         */

        // Any query parameters first
        if (getQueryVariable('nick'))
            defaults.nick = getQueryVariable('nick');

        if (window.location.hash)
            defaults.channel = window.location.hash;


        // Process the URL part by part, extracting as we go
        parts = window.location.pathname.toString().replace(_kiwi.app.get('base_path'), '').split('/');

        if (parts.length > 0) {
            parts.shift();

            if (parts.length > 0 && parts[0]) {
                // Check to see if we're dealing with an irc: uri, or whether we need to extract the server/channel info from the HTTP URL path.
                uricheck = parts[0].substr(0, 7).toLowerCase();
                if ((uricheck === 'ircs%3a') || (uricheck.substr(0,6) === 'irc%3a')) {
                    parts[0] = decodeURIComponent(parts[0]);
                    // irc[s]://<host>[:<port>]/[<channel>[?<password>]]
                    uricheck = /^irc(s)?:(?:\/\/?)?([^:\/]+)(?::([0-9]+))?(?:(?:\/)([^\?]*)(?:(?:\?)(.*))?)?$/.exec(parts[0]);
                    /*
                        uricheck[1] = ssl (optional)
                        uricheck[2] = host
                        uricheck[3] = port (optional)
                        uricheck[4] = channel (optional)
                        uricheck[5] = channel key (optional, channel must also be set)
                    */
                    if (uricheck) {
                        if (typeof uricheck[1] !== 'undefined') {
                            defaults.ssl = true;
                            if (defaults.port === 6667) {
                                defaults.port = 6697;
                            }
                        }
                        defaults.server = uricheck[2];
                        if (typeof uricheck[3] !== 'undefined') {
                            defaults.port = uricheck[3];
                        }
                        if (typeof uricheck[4] !== 'undefined') {
                            defaults.channel = '#' + uricheck[4];
                            if (typeof uricheck[5] !== 'undefined') {
                                defaults.channel_key = uricheck[5];
                            }
                        }
                    }
                    parts = [];
                } else {
                    // Extract the port+ssl if we find one
                    if (parts[0].search(/:/) > 0) {
                        defaults.port = parts[0].substring(parts[0].search(/:/) + 1);
                        defaults.server = parts[0].substring(0, parts[0].search(/:/));
                        if (defaults.port[0] === '+') {
                            defaults.port = parseInt(defaults.port.substring(1), 10);
                            defaults.ssl = true;
                        } else {
                            defaults.ssl = false;
                        }

                    } else {
                        defaults.server = parts[0];
                    }

                    parts.shift();
                }
            }

            if (parts.length > 0 && parts[0]) {
                defaults.channel = '#' + parts[0];
                parts.shift();
            }
        }

        // If any settings have been given by the server.. override any auto detected settings
        /**
         * Get any server restrictions as set in the server config
         * These settings can not be changed in the server selection dialog
         */
        if (_kiwi.app.server_settings && _kiwi.app.server_settings.connection) {
            if (_kiwi.app.server_settings.connection.server) {
                defaults.server = _kiwi.app.server_settings.connection.server;
            }

            if (_kiwi.app.server_settings.connection.port) {
                defaults.port = _kiwi.app.server_settings.connection.port;
            }

            if (_kiwi.app.server_settings.connection.ssl) {
                defaults.ssl = _kiwi.app.server_settings.connection.ssl;
            }

            if (_kiwi.app.server_settings.connection.channel) {
                defaults.channel = _kiwi.app.server_settings.connection.channel;
            }

            if (_kiwi.app.server_settings.connection.channel_key) {
                defaults.channel_key = _kiwi.app.server_settings.connection.channel_key;
            }

            if (_kiwi.app.server_settings.connection.nick) {
                defaults.nick = _kiwi.app.server_settings.connection.nick;
            }
        }

        // Set any random numbers if needed
        defaults.nick = defaults.nick.replace('?', Math.floor(Math.random() * 100000).toString());

        if (getQueryVariable('encoding'))
            defaults.encoding = getQueryVariable('encoding');

        return defaults;
    },
};


module.exports = _kiwi;

});
// Holds anything kiwi client specific (ie. front, gateway, _kiwi.plugs..)
/**
*   @namespace
*/
var _kiwi = {};

_kiwi.misc = {};
_kiwi.model = {};
_kiwi.view = {};
_kiwi.applets = {};
_kiwi.utils = {};


/**
 * A global container for third party access
 * Will be used to access a limited subset of kiwi functionality
 * and data (think: plugins)
 */
_kiwi.global = {
    build_version: '',  // Kiwi IRC version this is built from (Set from index.html)
    settings: undefined, // Instance of require('models/datastore')
    plugins: undefined, // Instance of require('models/pluginmanager')
    events: undefined, // Instance of PluginInterface
    rpc: undefined, // Instance of WebsocketRpc
    utils: {}, // References to misc. re-usable helpers / functions

    // Make public some internal utils for plugins to make use of
    initUtils: function() {
        this.utils.randomString = randomString;
        this.utils.secondsToTime = secondsToTime;
        this.utils.parseISO8601 = parseISO8601;
        this.utils.escapeRegex = escapeRegex;
        this.utils.formatIRCMsg = formatIRCMsg;
        this.utils.styleText = styleText;
        this.utils.hsl2rgb = hsl2rgb;
        this.utils.toUserMask = toUserMask;

        this.utils.notifications = require('utils/notifications');
        this.utils.formatDate = require('utils/formatdate');
    },

    addMediaMessageType: function(match, buildHtml) {
        require('views/mediamessage').addType(match, buildHtml);
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
            var app = require('models/application').instance(),
                connection_event;

            // If no connection id given, use all connections
            if (typeof connection_id !== 'undefined') {
                connection_event = 'connection:' + connection_id.toString();
            } else {
                connection_event = 'connection';
            }

            // Helper to get the network object
            var getNetwork = function() {
                var network = typeof connection_id === 'undefined' ?
                    app.connections.active_connection :
                    app.connections.getByConnectionId(connection_id);

                return network ?
                    network :
                    undefined;
            };

            // Create the return object (events proxy from the gateway)
            var obj = new this.EventComponent(_kiwi.gateway, connection_event);

            // Proxy several gateway functions onto the return object
            var funcs = {
                kiwi: 'kiwi', raw: 'raw', kick: 'kick', topic: 'topic',
                part: 'part', join: 'join', action: 'action', ctcp: 'ctcp',
                ctcpRequest: 'ctcpRequest', ctcpResponse: 'ctcpResponse',
                notice: 'notice', msg: 'privmsg', say: 'privmsg',
                changeNick: 'changeNick', channelInfo: 'channelInfo',
                mode: 'mode', quit: 'quit'
            };

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

            // Now for some network related functions...
            obj.createQuery = function(nick) {
                var network, restricted_keys;

                network = getNetwork();
                if (!network) {
                    return;
                }

                return network.createQuery(nick);
            };

            // Add the networks getters/setters
            obj.get = function(name) {
                var network, restricted_keys;

                network = getNetwork();
                if (!network) {
                    return;
                }

                restricted_keys = [
                    'password'
                ];
                if (restricted_keys.indexOf(name) > -1) {
                    return undefined;
                }

                return network.get(name);
            };

            obj.set = function() {
                var network = getNetwork();
                if (!network) {
                    return;
                }

                return network.set.apply(network, arguments);
            };

            return obj;
        },

        ControlInput: function() {
            var app = require('models/application').instance();
            var obj = new this.EventComponent(app.controlbox);
            var funcs = {
                run: 'processInput', addPluginIcon: 'addPluginIcon'
            };

            _.each(funcs, function(controlbox_fn, func_name) {
                obj[func_name] = function() {
                    var fn_name = controlbox_fn;
                    return app.controlbox[fn_name].apply(app.controlbox, arguments);
                };
            });

            // Give access to the control input textarea
            obj.input = app.controlbox.$('.inp');

            return obj;
        }
    },

    // Entry point to start the kiwi application
    init: function (opts, callback) {
        var locale_promise, theme_promise,
            that = this;

        opts = opts || {};

        this.initUtils();

        // Set up the settings datastore
        _kiwi.global.settings = require('models/datastore').instance('kiwi.settings');
        _kiwi.global.settings.load();

        // Set the window title
        window.document.title = opts.server_settings.client.window_title || 'Kiwi IRC';

        locale_promise = new Promise(function (resolve) {
            // In order, find a locale from the users saved settings, the URL, default settings on the server, or auto detect
            var locale = _kiwi.global.settings.get('locale') || opts.locale || opts.server_settings.client.settings.locale || 'magic';
            $.getJSON(opts.base_path + '/assets/locales/' + locale + '.json', function (locale) {
                if (locale) {
                    that.i18n = new Jed(locale);
                } else {
                    that.i18n = new Jed();
                }
                resolve();
            });
        });

        theme_promise = new Promise(function (resolve) {
            var text_theme = opts.server_settings.client.settings.text_theme || 'default';
            $.getJSON(opts.base_path + '/assets/text_themes/' + text_theme + '.json', function(text_theme) {
                opts.text_theme = text_theme;
                resolve();
            });
        });


        Promise.all([locale_promise, theme_promise]).then(function () {
            _kiwi.app = new (require('models/application'))(opts);

            // Start the client up
            _kiwi.app.initializeInterfaces();

            // Event emitter to let plugins interface with parts of kiwi
            _kiwi.global.events  = new PluginInterface();

            // Now everything has started up, load the plugin manager for third party plugins
            _kiwi.global.plugins = new (require('models/pluginmanager'))();

            callback();

        }).then(null, function(err) {
            console.error(err.stack);
        });
    },

    start: function() {
        var app = require('models/application').instance();
        app.showStartup();
    },

    // Allow plugins to change the startup applet
    registerStartupApplet: function(startup_applet_name) {
        var app = require('models/application').instance();
        app.startup_applet_name = startup_applet_name;
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
        var app = require('models/application').instance();
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
        if (app.server_settings.client) {
            if (app.server_settings.client.nick)
                defaults.nick = app.server_settings.client.nick;

            if (app.server_settings.client.server)
                defaults.server = app.server_settings.client.server;

            if (app.server_settings.client.port)
                defaults.port = app.server_settings.client.port;

            if (app.server_settings.client.ssl)
                defaults.ssl = app.server_settings.client.ssl;

            if (app.server_settings.client.channel)
                defaults.channel = app.server_settings.client.channel;

            if (app.server_settings.client.channel_key)
                defaults.channel_key = app.server_settings.client.channel_key;
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
        parts = window.location.pathname.toString().replace(app.get('base_path'), '').split('/');

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
        if (app.server_settings && app.server_settings.connection) {
            if (app.server_settings.connection.server) {
                defaults.server = app.server_settings.connection.server;
            }

            if (app.server_settings.connection.port) {
                defaults.port = app.server_settings.connection.port;
            }

            if (app.server_settings.connection.ssl) {
                defaults.ssl = app.server_settings.connection.ssl;
            }
        }

        // Set any random numbers if needed
        defaults.nick = defaults.nick.replace('?', Math.floor(Math.random() * 100000).toString());

        if (getQueryVariable('encoding'))
            defaults.encoding = getQueryVariable('encoding');

        return defaults;
    },
};



// If within a closure, expose the kiwi globals
if (typeof global !== 'undefined') {
    global.kiwi = _kiwi.global;
} else {
    // Not within a closure so set a var in the current scope
    var kiwi = _kiwi.global;
}

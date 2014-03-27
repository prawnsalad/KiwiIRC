_kiwi.model.NewConnection = Backbone.Collection.extend({
    initialize: function() {
        this.view = new _kiwi.view.ServerSelect({model: this});

        this.view.bind('server_connect', this.onMakeConnection, this);

    },


    populateDefaultServerSettings: function () {
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

        this.view.populateFields(defaults);
    },


    onMakeConnection: function(new_connection_event) {
        var that = this,
            transport_path = '',
            auto_connect_details = new_connection_event;

        this.view.networkConnecting();

        // If not connected already, connect then send the IRC connect info
        if (!_kiwi.gateway.isConnected()) {
            _kiwi.gateway.connect(function() {
                that.makeConnection(new_connection_event);
            });

        } else {
            this.makeConnection(new_connection_event);
        }


    },


    onKiwiServerNotFound: function() {
        this.view.showError();
    },


    makeConnection: function(new_connection_event) {
        var that = this;

        this.connect_details = new_connection_event;

        _kiwi.gateway.newConnection({
            nick: new_connection_event.nick,
            host: new_connection_event.server,
            port: new_connection_event.port,
            ssl: new_connection_event.ssl,
            password: new_connection_event.password,
            options: new_connection_event.options,
            age: new_connection_event.age,
            gender: new_connection_event.gender,
            location: new_connection_event.location
        }, function(err, network) {
            that.onNewNetwork(err, network);
        });
    },


    onNewNetwork: function(err, network) {
        // Show any errors if given
        if (err) {
            this.view.showError(err);
        }

        if (network && this.connect_details) {
            network.auto_join = {
                channel: this.connect_details.channel,
                key: this.connect_details.channel_key
            };

            this.trigger('new_network', network);
        }
    }
});
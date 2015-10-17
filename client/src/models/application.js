(function () {

    _melon.model.Application = Backbone.Model.extend({
        /** _melon.view.Application */
        view: null,

        /** _melon.view.StatusMessage */
        message: null,

        initialize: function (options) {
            this.app_options = options;

            if (options.container) {
                this.set('container', options.container);
            }

            // The base url to the melon server
            this.set('base_path', options.base_path ? options.base_path : '');

            // Path for the settings.json file
            this.set('settings_path', options.settings_path ?
                    options.settings_path :
                    this.get('base_path') + '/assets/settings.json'
            );

            // Any options sent down from the server
            this.server_settings = options.server_settings || {};
            this.translations = options.translations || {};
            this.themes = options.themes || [];
            this.text_theme = options.text_theme || {};

            // The applet to initially load
            this.startup_applet_name = options.startup || 'melon_startup';

            // Set any default settings before anything else is applied
            if (this.server_settings && this.server_settings.client && this.server_settings.client.settings) {
                this.applyDefaultClientSettings(this.server_settings.client.settings);
            }
        },


        initializeInterfaces: function () {
            // Best guess at where the melon server is if not already specified
            var melon_server = this.app_options.melon_server || this.detectMelonServer();

            // Set the gateway up
            _melon.gateway = new _melon.model.Gateway({melon_server: melon_server});
            this.bindGatewayCommands(_melon.gateway);

            this.initializeClient();
            this.initializeGlobals();

            this.view.barsHide(true);
        },


        detectMelonServer: function () {
            // If running from file, default to localhost:7777 by default
            if (window.location.protocol === 'file:') {
                return 'http://localhost:7778';
            } else {
                // Assume the melon server is on the same server
                return window.location.protocol + '//' + window.location.host;
            }
        },


        showStartup: function() {
            this.startup_applet = _melon.model.Applet.load(this.startup_applet_name, {no_tab: true});
            this.startup_applet.tab = this.view.$('.console');
            this.startup_applet.view.show();

            _melon.global.events.emit('loaded');
        },


        initializeClient: function () {
            this.view = new _melon.view.Application({model: this, el: this.get('container')});

            // Takes instances of model_network
            this.connections = new _melon.model.NetworkPanelList();

            // If all connections are removed at some point, hide the bars
            this.connections.on('remove', _.bind(function() {
                if (this.connections.length === 0) {
                    this.view.barsHide();
                }
            }, this));

            // Applets panel list
            this.applet_panels = new _melon.model.PanelList();
            this.applet_panels.view.$el.addClass('panellist applets');
            this.view.$el.find('.tabs').append(this.applet_panels.view.$el);

            /**
             * Set the UI components up
             */
            this.controlbox = (new _melon.view.ControlBox({el: $('#melon .controlbox')[0]})).render();
            this.client_ui_commands = new _melon.misc.ClientUiCommands(this, this.controlbox);

            this.rightbar = new _melon.view.RightBar({el: this.view.$('.right_bar')[0]});
            this.topicbar = new _melon.view.TopicBar({el: this.view.$el.find('.topic')[0]});

            new _melon.view.AppToolbar({el: _melon.app.view.$el.find('.toolbar .app_tools')[0]});
            new _melon.view.ChannelTools({el: _melon.app.view.$el.find('.channel_tools')[0]});

            this.message = new _melon.view.StatusMessage({el: this.view.$el.find('.status_message')[0]});

            this.resize_handle = new _melon.view.ResizeHandler({el: this.view.$el.find('.memberlists_resize_handle')[0]});

            // Rejigg the UI sizes
            this.view.doLayout();
        },


        initializeGlobals: function () {
            _melon.global.connections = this.connections;

            _melon.global.panels = this.panels;
            _melon.global.panels.applets = this.applet_panels;

            _melon.global.components.Applet = _melon.model.Applet;
            _melon.global.components.Panel =_melon.model.Panel;
            _melon.global.components.MenuBox = _melon.view.MenuBox;
            _melon.global.components.DataStore = _melon.model.DataStore;
            _melon.global.components.Notification = _melon.view.Notification;
            _melon.global.components.Events = function() {
                return melon.events.createProxy();
            };
        },


        applyDefaultClientSettings: function (settings) {
            _.each(settings, function (value, setting) {
                if (typeof _melon.global.settings.get(setting) === 'undefined') {
                    _melon.global.settings.set(setting, value);
                }
            });
        },


        panels: (function() {
            var active_panel;

            var fn = function(panel_type) {
                var app = _melon.app,
                    panels;

                // Default panel type
                panel_type = panel_type || 'connections';

                switch (panel_type) {
                case 'connections':
                    panels = app.connections.panels();
                    break;
                case 'applets':
                    panels = app.applet_panels.models;
                    break;
                }

                // Active panels / server
                panels.active = active_panel;
                panels.server = app.connections.active_connection ?
                    app.connections.active_connection.panels.server :
                    null;

                return panels;
            };

            _.extend(fn, Backbone.Events);

            // Keep track of the active panel. Channel/query/server or applet
            fn.bind('active', function (new_active_panel) {
                var previous_panel = active_panel;
                active_panel = new_active_panel;

                _melon.global.events.emit('panel:active', {previous: previous_panel, active: active_panel});
            });

            return fn;
        })(),


        bindGatewayCommands: function (gw) {
            var that = this;

            // As soon as an IRC connection is made, show the full client UI
            gw.on('connection:connect', function (event) {
                that.view.barsShow();
            });


            /**
             * Handle the reconnections to the melon server
             */
            (function () {
                // 0 = non-reconnecting state. 1 = reconnecting state.
                var gw_stat = 0;

                gw.on('disconnect', function (event) {
                    that.view.$el.removeClass('connected');

                    // Reconnection phase will start to kick in
                    gw_stat = 1;
                });


                gw.on('reconnecting', function (event) {
                    var msg = translateText('client_models_application_reconnect_in_x_seconds', [event.delay/1000]) + '...';

                    // Only need to mention the repeating re-connection messages on server panels
                    _melon.app.connections.forEach(function(connection) {
                        connection.panels.server.addMsg('', styleText('quit', {text: msg}), 'action quit');
                    });
                });


                // After the socket has connected, melon handshakes and then triggers a melon:connected event
                gw.on('melon:connected', function (event) {
                    var msg;

                    that.view.$el.addClass('connected');

                    // Make the rpc globally available for plugins
                    _melon.global.rpc = _melon.gateway.rpc;

                    _melon.global.events.emit('connected');

                    // If we were reconnecting, show some messages we have connected back OK
                    if (gw_stat === 1) {

                        // No longer in the reconnection state
                        gw_stat = 0;

                        msg = translateText('client_models_application_reconnect_successfully') + ' :)';
                        that.message.text(msg, {timeout: 5000});

                        // Mention the re-connection on every channel
                        _melon.app.connections.forEach(function(connection) {
                            connection.reconnect();

                            connection.panels.server.addMsg('', styleText('rejoin', {text: msg}), 'action join');

                            connection.panels.forEach(function(panel) {
                                if (!panel.isChannel())
                                    return;

                                panel.addMsg('', styleText('rejoin', {text: msg}), 'action join');
                            });
                        });
                    }

                });
            })();


            gw.on('melon:reconfig', function () {
                $.getJSON(that.get('settings_path'), function (data) {
                    that.server_settings = data.server_settings || {};
                    that.translations = data.translations || {};
                });
            });


            gw.on('melon:jumpserver', function (data) {
                var serv;
                // No server set? Then nowhere to jump to.
                if (typeof data.melon_server === 'undefined')
                    return;

                serv = data.melon_server;

                // Strip any trailing slash from the end
                if (serv[serv.length-1] === '/')
                    serv = serv.substring(0, serv.length-1);

                // Force the jumpserver now?
                if (data.force) {
                    // Get an interval between 5 and 6 minutes so everyone doesn't reconnect it all at once
                    var jump_server_interval = Math.random() * (360 - 300) + 300;
                    jump_server_interval = 1;

                    // Tell the user we are going to disconnect, wait 5 minutes then do the actual reconnect
                    var msg = _melon.global.i18n.translate('client_models_application_jumpserver_prepare').fetch();
                    that.message.text(msg, {timeout: 10000});

                    setTimeout(function forcedReconnect() {
                        var msg = _melon.global.i18n.translate('client_models_application_jumpserver_reconnect').fetch();
                        that.message.text(msg, {timeout: 8000});

                        setTimeout(function forcedReconnectPartTwo() {
                            _melon.gateway.set('melon_server', serv);

                            _melon.gateway.reconnect(function() {
                                // Reconnect all the IRC connections
                                that.connections.forEach(function(con){ con.reconnect(); });
                            });
                        }, 5000);

                    }, jump_server_interval * 1000);
                }
            });
        }

    });

})();

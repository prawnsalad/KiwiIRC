/**
 * @module ui/application/application
 */
define('ui/application/', function(require, exports, module) {

    var utils = require('helpers/utils');

    // Singleton instance
    var instance = null;

    module.exports = Backbone.Model.extend({
        /** require('./view') */
        view: null,

        /** require('ui/statusmessage/statusmessage') */
        message: null,

        initialize: function (options) {
            instance = this;

            this.app_options = options;

            if (options.container) {
                this.set('container', options.container);
            }

            // The base url to the kiwi server
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
            this.startup_applet_name = options.startup || 'kiwi_startup';

            // Set any default settings before anything else is applied
            if (this.server_settings && this.server_settings.client && this.server_settings.client.settings) {
                this.applyDefaultClientSettings(this.server_settings.client.settings);
            }
        },


        initializeInterfaces: function () {
            var KiwiServerGateway = require('gateways/kiwiserver');
            var kiwi_server = '';

            // The kiwi server to connect to may be a string for a single option,
            // or an array of kiwi servers to pick one at random from.
            if (typeof this.app_options.kiwi_server === 'string') {
                kiwi_server = this.app_options.kiwi_server;
            } else if (_.isArray(this.app_options.kiwi_server)) {
                kiwi_server = _.sample(this.app_options.kiwi_server);
            } else {
                // Best guess at where the kiwi server is
                kiwi_server = this.detectKiwiServer();
            }

            // Set the gateway up
            _kiwi.gateway = new KiwiServerGateway({kiwi_server: kiwi_server});
            this.bindGatewayCommands(_kiwi.gateway);

            this.initializeClient();
            this.initializeGlobals();

            this.view.barsHide(true);
        },


        detectKiwiServer: function () {
            // If running from file, default to localhost:7777 by default
            if (window.location.protocol === 'file:') {
                return 'http://localhost:7778';
            } else {
                // Assume the kiwi server is on the same server
                return window.location.protocol + '//' + window.location.host;
            }
        },


        showStartup: function() {
            this.startup_applet = require('ui/panels/applet').load(this.startup_applet_name, {no_tab: true});
            this.startup_applet.tab = this.view.$('.console');
            this.startup_applet.view.show();

            _kiwi.global.events.emit('loaded');
        },


        initializeClient: function () {
            this.view = new (require('./view'))({model: this, el: this.get('container')});

            // Takes instances of model_network
            this.connections = new (require('ui/networkpanellist/'))();

            // If all connections are removed at some point, hide the bars
            this.connections.on('remove', _.bind(function() {
                if (this.connections.length === 0) {
                    this.view.barsHide();
                }
            }, this));

            // Applets panel list
            this.applet_panels = new (require('ui/paneltabs/'))();
            this.applet_panels.view.$el.addClass('panellist applets');
            this.view.$el.find('.tabs').append(this.applet_panels.view.$el);

            /**
             * Set the UI components up
             */
            this.controlbox = (new (require('ui/controlbox/'))({el: $('#kiwi .controlbox')[0]})).render();
            this.client_ui_commands = new (require('libs/clientuicommands'))(this, this.controlbox);

            this.rightbar = new (require('ui/rightbar/'))({el: this.view.$('.right-bar')[0]});
            this.topicbar = new (require('ui/topicbar/'))({el: this.view.$el.find('.topic')[0]});

            new (require('ui/apptoolbar/'))({el: this.view.$el.find('.toolbar .app-tools')[0]});
            new (require('ui/channeltools/'))({el: this.view.$el.find('.channel-tools')[0]});

            this.message = new (require('ui/statusmessage/'))({el: this.view.$el.find('.status-message')[0]});

            this.resize_handle = new (require('ui/resizehandler/'))({el: this.view.$el.find('.memberlists-resize-handle')[0]});

            // Rejigg the UI sizes
            this.view.doLayout();
        },


        initializeGlobals: function () {
            _kiwi.global.connections = this.connections;

            _kiwi.global.panels = this.panels;
            _kiwi.global.panels.applets = this.applet_panels;

            _kiwi.global.components.Applet = require('ui/panels/applet');
            _kiwi.global.components.Panel =require('ui/panels/panel');
            _kiwi.global.components.MenuBox = require('ui/menubox/');
            _kiwi.global.components.DataStore = require('libs/datastore');
            _kiwi.global.components.Notification = require('ui/notification/');
            _kiwi.global.components.Events = function() {
                return kiwi.events.createProxy();
            };
        },


        applyDefaultClientSettings: function (settings) {
            _.each(settings, function (value, setting) {
                if (typeof _kiwi.global.settings.get(setting) === 'undefined') {
                    _kiwi.global.settings.set(setting, value);
                }
            });
        },


        panels: (function() {
            var active_panel;

            var fn = function(panel_type) {
                var application = require('./index').instance(),
                    panels;

                // Default panel type
                panel_type = panel_type || 'connections';

                switch (panel_type) {
                case 'connections':
                    panels = application.connections.panels();
                    break;
                case 'applets':
                    panels = application.applet_panels.models;
                    break;
                }

                // Active panels / server
                panels.active = active_panel;
                panels.server = application.connections.active_connection ?
                    application.connections.active_connection.panels.server :
                    null;

                return panels;
            };

            _.extend(fn, Backbone.Events);

            // Keep track of the active panel. Channel/query/server or applet
            fn.bind('active', function (new_active_panel) {
                var previous_panel = active_panel;
                active_panel = new_active_panel;

                _kiwi.global.events.emit('panel:active', {previous: previous_panel, active: active_panel});
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
             * Handle the reconnections to the kiwi server
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
                    var msg = utils.translateText('client_models_application_reconnect_in_x_seconds', [event.delay/1000]) + '...';

                    // Only need to mention the repeating re-connection messages on server panels
                    that.connections.forEach(function(connection) {
                        connection.panels.server.addMsg('', utils.styleText('quit', {text: msg}), 'action quit');
                    });
                });


                // After the socket has connected, kiwi handshakes and then triggers a kiwi:connected event
                gw.on('kiwi:connected', function (event) {
                    var msg;

                    that.view.$el.addClass('connected');

                    // Make the rpc globally available for plugins
                    _kiwi.global.rpc = _kiwi.gateway.rpc;

                    _kiwi.global.events.emit('connected');

                    // If we were reconnecting, show some messages we have connected back OK
                    if (gw_stat === 1) {

                        // No longer in the reconnection state
                        gw_stat = 0;

                        msg = utils.translateText('client_models_application_reconnect_successfully') + ' :)';
                        that.message.text(msg, {timeout: 5000});

                        // Mention the re-connection on every channel
                        that.connections.forEach(function(connection) {
                            connection.reconnect();

                            connection.panels.server.addMsg('', utils.styleText('rejoin', {text: msg}), 'action join');

                            connection.panels.forEach(function(panel) {
                                if (!panel.isChannel())
                                    return;

                                // The memberlist will reset itself and be updated with NAMES output
                                panel.get('members').reset();

                                panel.addMsg('', utils.styleText('rejoin', {text: msg}), 'action join');
                            });
                        });
                    }

                });
            })();


            gw.on('kiwi:reconfig', function () {
                $.getJSON(that.get('settings_path'), function (data) {
                    that.server_settings = data.server_settings || {};
                    that.translations = data.translations || {};
                });
            });


            gw.on('kiwi:jumpserver', function (data) {
                var serv;
                // No server set? Then nowhere to jump to.
                if (typeof data.kiwi_server === 'undefined')
                    return;

                serv = data.kiwi_server;

                // Strip any trailing slash from the end
                if (serv[serv.length-1] === '/')
                    serv = serv.substring(0, serv.length-1);

                // Force the jumpserver now?
                if (data.force) {
                    // Get an interval between 5 and 6 minutes so everyone doesn't reconnect it all at once
                    var jump_server_interval = Math.random() * (360 - 300) + 300;
                    jump_server_interval = 1;

                    // Tell the user we are going to disconnect, wait 5 minutes then do the actual reconnect
                    var msg = utils.translateText('client_models_application_jumpserver_prepare');
                    that.message.text(msg, {timeout: 10000});

                    setTimeout(function forcedReconnect() {
                        var msg = utils.translateText('client_models_application_jumpserver_reconnect');
                        that.message.text(msg, {timeout: 8000});

                        setTimeout(function forcedReconnectPartTwo() {
                            _kiwi.gateway.set('kiwi_server', serv);

                            _kiwi.gateway.reconnect(function() {
                                // Reconnect all the IRC connections
                                that.connections.forEach(function(con){ con.reconnect(); });
                            });
                        }, 5000);

                    }, jump_server_interval * 1000);
                }
            });


            gw.on('kiwi:asset_files_changes', function (data) {
                that.view.reloadStyles();
            });
        }

    }, {
        instance: function() {
            return instance;
        }
    });

});

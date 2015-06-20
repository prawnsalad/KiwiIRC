define('models/applet', function(require, exports, module) {
    module.exports = require('models/panel').extend({
        initialize: function (attributes) {
            // Temporary name
            var name = "applet_"+(new Date().getTime().toString()) + Math.ceil(Math.random()*100).toString();
            this.view = new (require('views/applet'))({model: this, name: name});

            this.set({
                "name": name
            }, {"silent": true});

            // Holds the loaded applet
            this.loaded_applet = null;
        },


        // Load an applet within this panel
        load: function (applet_object, applet_name) {
            if (typeof applet_object === 'object') {
                // Make sure this is a valid Applet
                if (applet_object.get || applet_object.extend) {

                    // Try find a title for the applet
                    this.set('title', applet_object.get('title') || _kiwi.global.i18n.translate('client_models_applet_unknown').fetch());

                    // Update the tabs title if the applet changes it
                    applet_object.bind('change:title', function (obj, new_value) {
                        this.set('title', new_value);
                    }, this);

                    // If this applet has a UI, add it now
                    this.view.$el.html('');
                    if (applet_object.view) {
                        this.view.$el.append(applet_object.view.$el);
                    }

                    // Keep a reference to this applet
                    this.loaded_applet = applet_object;

                    this.loaded_applet.trigger('applet_loaded');
                }

            } else if (typeof applet_object === 'string') {
                // Treat this as a URL to an applet script and load it
                this.loadFromUrl(applet_object, applet_name);
            }

            return this;
        },


        loadFromUrl: function(applet_url, applet_name) {
            var that = this;

            this.view.$el.html(_kiwi.global.i18n.translate('client_models_applet_loading').fetch());
            $script(applet_url, function () {
                // Check if the applet loaded OK
                if (!_kiwi.applets[applet_name]) {
                    that.view.$el.html(_kiwi.global.i18n.translate('client_models_applet_notfound').fetch());
                    return;
                }

                // Load a new instance of this applet
                that.load(new _kiwi.applets[applet_name]());
            });
        },


        close: function () {
            this.view.$el.remove();
            this.destroy();

            this.view = undefined;

            // Call the applets dispose method if it has one
            if (this.loaded_applet && this.loaded_applet.dispose) {
                this.loaded_applet.dispose();
            }

            // Call the inherited close()
            this.constructor.__super__.close.apply(this, arguments);
        },

        isApplet: function () {
            return true;
        }
    },


    {
        // Load an applet type once only. If it already exists, return that
        loadOnce: function (applet_name) {
            var application = require('models/application').instance();

            // See if we have an instance loaded already
            var applet = _.find(application.panels('applets'), function(panel) {
                // Ignore if it's not an applet
                if (!panel.isApplet()) return;

                // Ignore if it doesn't have an applet loaded
                if (!panel.loaded_applet) return;

                if (panel.loaded_applet.get('_applet_name') === applet_name) {
                    return true;
                }
            });

            if (applet) return applet;


            // If we didn't find an instance, load a new one up
            return this.load(applet_name);
        },


        load: function (applet_name, options) {
            var application = require('models/application').instance(),
                applet, applet_obj;

            options = options || {};

            applet_obj = this.getApplet(applet_name);

            if (!applet_obj)
                return;

            // Create the applet and load the content
            applet = new (require('models/applet'))();
            applet.load(new applet_obj({_applet_name: applet_name}));

            // Add it into the tab list if needed (default)
            if (!options.no_tab)
                application.applet_panels.add(applet);


            return applet;
        },


        getApplet: function (applet_name) {
            return _kiwi.applets[applet_name] || null;
        },


        register: function (applet_name, applet) {
            _kiwi.applets[applet_name] = applet;
        }
    });
});
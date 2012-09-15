kiwi.model.Applet = kiwi.model.Panel.extend({
    // Used to determine if this is an applet panel. Applet panel tabs are treated
    // differently than others
    applet: true,

    loaded_applet: null,

    initialize: function (attributes) {
        // Temporary name
        var name = "applet_"+(new Date().getTime().toString()) + Math.ceil(Math.random()*100).toString();
        this.view = new kiwi.view.Applet({model: this, name: name});

        this.set({
            "name": name
        }, {"silent": true});
    },

    // Load an applet within this panel
    load: function (applet_object, applet_name) {
        if (typeof applet_object === 'object') {
            // Make sure this is a valid Applet
            if (applet_object.get || applet_object.extend) {

                // Try find a title for the applet
                this.set('title', applet_object.get('title') || 'Unknown Applet');

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
            }

        } else if (typeof applet_object === 'string') {
            // Treat this as a URL to an applet script and load it
            this.loadFromUrl(applet_object, applet_name);
        }

        return this;
    },

    loadFromUrl: function(applet_url, applet_name) {
        var that = this;

        this.view.$el.html('Loading..');
        $script(applet_url, function () {
            // Check if the applet loaded OK
            if (!kiwi.applets[applet_name]) {
                that.view.$el.html('Not found');
                return;
            }

            // Load a new instance of this applet
            that.load(new kiwi.applets[applet_name]());
        });
    }
});
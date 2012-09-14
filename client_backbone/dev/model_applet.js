kiwi.model.Applet = kiwi.model.Panel.extend({
    // Used to determine if this is an applet panel. Applet panel tabs are treated
    // differently than others
    applet: true,

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
            this.set('title', applet_object.title || 'Something..');
            this.view.$el.html('');
            this.view.$el.append(applet_object.$el);

        } else if (typeof applet_object === 'string') {
            // Treat this as a URL to an applet script and load it
            this.loadFromUrl(applet_object, applet_name);
        }
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
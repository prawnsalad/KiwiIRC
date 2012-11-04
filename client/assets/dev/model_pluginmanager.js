kiwi.model.PluginManager = Backbone.Model.extend({
    initialize: function () {
        this.$plugin_holder = $('<div id="kiwi_plugins" style="display:none;"></div>').appendTo('#kiwi');
        this.loaded_plugins = {};
    },

    // Load an applet within this panel
    load: function (url) {
        if (this.loaded_plugins[url]) {
            this.unload(url);
        }

        this.loaded_plugins[url] = $('<div></div>');
        this.loaded_plugins[url].appendTo(this.$plugin_holder)
            .load(url);
    },


    unload: function (url) {
        if (!this.loaded_plugins[url]) {
            return;
        }

        this.loaded_plugins[url].remove();
        delete this.loaded_plugins[url];
    }
});
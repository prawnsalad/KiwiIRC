define('models/pluginmanager', function(require, exports, module) {
    module.exports = Backbone.Model.extend({
        initialize: function () {
            this.$plugin_holder = $('<div id="kiwi_plugins" style="display:none;"></div>')
                .appendTo(_kiwi.app.view.$el);

            this.loading_plugins = 0;
            this.loaded_plugins = {};
        },

        // Load an applet within this panel
        load: function (url) {
            var that = this;

            if (this.loaded_plugins[url]) {
                this.unload(url);
            }

            this.loading_plugins++;

            this.loaded_plugins[url] = $('<div></div>');
            this.loaded_plugins[url].appendTo(this.$plugin_holder)
                .load(url, _.bind(that.pluginLoaded, that));
        },


        unload: function (url) {
            if (!this.loaded_plugins[url]) {
                return;
            }

            this.loaded_plugins[url].remove();
            delete this.loaded_plugins[url];
        },


        // Called after each plugin is loaded
        pluginLoaded: function() {
            this.loading_plugins--;

            if (this.loading_plugins === 0) {
                this.trigger('loaded');
            }
        },
    });
});
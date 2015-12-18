define('ui/paneltabs/paneltabs', function(require, exports, module) {
    module.exports = Backbone.Collection.extend({
        model: require('ui/panels/panel'),

        comparator: function (chan) {
            return chan.get('name');
        },
        initialize: function (elements, network) {
            var that = this;

            // If this PanelList is associated with a network/connection
            if (network) {
                this.network = network;
            }

            this.view = new (require('./tabs'))({model: this});

            // Holds the active panel
            this.active = null;

            // Keep a tab on the active panel
            this.bind('active', function (active_panel) {
                this.active = active_panel;
            }, this);

            this.bind('add', function(panel) {
                panel.set('panel_list', this);
            });
        },



        getByCid: function (cid) {
            if (typeof name !== 'string') return;

            return this.find(function (c) {
                return cid === c.cid;
            });
        },



        getByName: function (name) {
            if (typeof name !== 'string') return;

            return this.find(function (c) {
                return name.toLowerCase() === c.get('name').toLowerCase();
            });
        }
    });
});
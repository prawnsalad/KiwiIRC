_kiwi.model.PanelList = Backbone.Collection.extend({
    model: _kiwi.model.Panel,

    comparator: function (chan) {
        return chan.get('name');
    },
    initialize: function (elements, network) {

        // The network this PanelList is associated with
        this.network = network;

        this.view = new _kiwi.view.Tabs({model: this});

        // Holds the active panel
        this.active = null;

        // Keep a tab on the active panel
        this.bind('active', function (active_panel) {
            this.active = active_panel;
        }, this);
    },



    getByName: function (name) {
        if (typeof name !== 'string') return;

        return this.find(function (c) {
            return name.toLowerCase() === c.get('name').toLowerCase();
        });
    }
});



_kiwi.model.NetworkPanelList = Backbone.Collection.extend({
    model: _kiwi.model.Network,

    initialize: function() {
        this.on('add', this.onNetworkAdd, this);
        this.on('remove', this.onNetworkRemove, this);

        // Current active panel
        this.active = undefined;
        this.active_connection = undefined;
    },

    getByConnectionId: function(id) {
        return this.find(function(connection){
            return connection.get('connection_id') == id;
        });
    },


    onNetworkAdd: function(network) {
        network.panels.on('active', this.onPanelActive, this);
    },

    onNetworkRemove: function(network) {
        network.panels.off('active', this.onPanelActive, this);
    },

    onPanelActive: function(panel) {
        var connection = this.getByConnectionId(panel.tab.data('connection_id'));
        this.trigger('active', panel, connection);

        this.active_connection = connection;
        this.active = panel;
    }
});
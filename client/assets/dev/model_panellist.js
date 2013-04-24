_kiwi.model.PanelList = Backbone.Collection.extend({
    model: _kiwi.model.Panel,

    comparator: function (chan) {
        return chan.get('name');
    },
    initialize: function (elements, network) {
        var that = this;

        // The network this PanelList is associated with
        this.network = network;

        this.view = new _kiwi.view.Tabs({model: this});

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
        this.view = new _kiwi.view.NetworkTabs({model: this});
        
        this.on('add', this.onNetworkAdd, this);
        this.on('remove', this.onNetworkRemove, this);

        // Current active connection / panel
        this.active_connection = undefined;
        this.active_panel = undefined;

        // TODO: Remove this - legacy
        this.active = undefined;
    },

    getByConnectionId: function(id) {
        return this.find(function(connection){
            return connection.get('connection_id') == id;
        });
    },

    panels: function() {
        var panels = [];

        this.each(function(network) {
            panels = panels.concat(network.panels.models);
        });

        return panels;
    },


    onNetworkAdd: function(network) {
        network.panels.on('active', this.onPanelActive, this);

        // if it's our first connection, set it active
        if (this.models.length === 1) {
            this.active_connection = network;
            this.active_panel = network.panels.server;

            // TODO: Remove this - legacy
            this.active = this.active_panel;
        }
    },

    onNetworkRemove: function(network) {
        network.panels.off('active', this.onPanelActive, this);
    },

    onPanelActive: function(panel) {
        var connection = this.getByConnectionId(panel.tab.data('connection_id'));
        this.trigger('active', panel, connection);

        this.active_connection = connection;
        this.active_panel = panel;

        // TODO: Remove this - legacy
        this.active = panel;
    }
});
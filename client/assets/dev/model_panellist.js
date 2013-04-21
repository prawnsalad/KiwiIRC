_kiwi.model.PanelList = Backbone.Collection.extend({
    model: _kiwi.model.Panel,

    comparator: function (chan) {
        return chan.get('name');
    },
    initialize: function (network) {

        // The network this PanelList is associated with
        this.network = network;

        this.view = new _kiwi.view.Tabs({model: this});

        // Automatically create a server tab
        var server_panel = new _kiwi.model.Server({name: 'Server'});

        this.add(server_panel);
        this.server = server_panel;

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
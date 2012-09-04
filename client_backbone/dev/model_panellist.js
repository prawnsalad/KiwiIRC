kiwi.model.PanelList = Backbone.Collection.extend({
    model: kiwi.model.Panel,

    // Holds the active panel
    active: null,

    comparator: function (chan) {
        return chan.get("name");
    },
    initialize: function () {
        this.view = new kiwi.view.Tabs({"el": $('#toolbar .panellist')[0], "model": this});

        // Automatically create a server tab
        this.add(new kiwi.model.Server({'name': kiwi.gateway.get('name')}));
        this.server = this.getByName(kiwi.gateway.get('name'));

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
_kiwi.model.PanelList = Backbone.Collection.extend({
    model: _kiwi.model.Panel,

    comparator: function (chan) {
        return chan.get("name");
    },
    initialize: function () {
        this.view = new _kiwi.view.Tabs({"el": $('#tabs')[0], "model": this});

        // Automatically create a server tab
        this.add(new _kiwi.model.Server({'name': _kiwi.gateway.get('name')}));
        this.server = this.getByName(_kiwi.gateway.get('name'));

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
    },
	getNotServer: function(){
		return this.find(function (c) {
            return c.get('name').toLowerCase() !== 'server';
        });
	}
});

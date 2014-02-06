// Model for this = _kiwi.model.NetworkPanelList
_kiwi.view.NetworkTabs = Backbone.View.extend({
    tagName: 'ul',
    className: 'connections',

    initialize: function() {
        this.model.on('add', this.networkAdded, this);
        this.model.on('remove', this.networkRemoved, this);

        this.$el.appendTo(_kiwi.app.view.$el.find('.tabs'));
    },

    networkAdded: function(network) {
        $('<li class="connection"></li>')
            .append(network.panels.view.$el)
            .appendTo(this.$el);
    },

    networkRemoved: function(network) {
        network.panels.view.remove();
        console.log("networkRemoved");
        console.log(network);
        _kiwi.app.view.doLayout();
    }
});
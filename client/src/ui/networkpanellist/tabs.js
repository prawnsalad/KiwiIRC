// Model for this = require('./networkpanellist')
define('ui/networkpanellist/tabs', function(require, exports, module) {

    var Application = require('ui/application/application');

    module.exports = Backbone.View.extend({
        tagName: 'ul',
        className: 'connections',

        initialize: function() {
            this.model.on('add', this.networkAdded, this);
            this.model.on('remove', this.networkRemoved, this);

            this.$el.appendTo(Application.instance().view.$el.find('.tabs'));
        },

        networkAdded: function(network) {
            $('<li class="connection"></li>')
                .append(network.panels.view.$el)
                .appendTo(this.$el);
        },

        networkRemoved: function(network) {
            // Remove the containing list element
            network.panels.view.$el.parent().remove();

            network.panels.view.remove();

            Application.instance().view.doLayout();
        }
    });
});
define(function (require, exports, module) {

// Model for this = _kiwi.model.PanelList
module.exports = Backbone.View.extend({
    tagName: 'ul',
    className: 'panellist',

    events: {
        'click li': 'tabClick',
        'click li .part': 'partClick'
    },

    initialize: function () {
        this.model.on("add", this.panelAdded, this);
        this.model.on("remove", this.panelRemoved, this);
        this.model.on("reset", this.render, this);

        this.model.on('active', this.panelActive, this);

        // Network tabs start with a server, so determine what we are now
        this.is_network = false;

        if (this.model.network) {
            this.is_network = true;

            this.model.network.on('change:name', function (network, new_val) {
                $('span', this.model.server.tab).text(new_val);
            }, this);
        }

        this.panel_access = new Array();
    },

    render: function () {
        var that = this;

        this.$el.empty();

        if (this.is_network) {
            // Add the server tab first
            this.model.server.tab
                .data('panel', this.model.server)
                .data('connection_id', this.model.network.get('connection_id'))
                .appendTo(this.$el);
        }

        // Go through each panel adding its tab
        this.model.forEach(function (panel) {
            // If this is the server panel, ignore as it's already added
            if (this.is_network && panel == that.model.server)
                return;

            panel.tab.data('panel', panel);

            if (this.is_network)
                panel.tab.data('connection_id', this.model.network.get('connection_id'));

            panel.tab.appendTo(that.$el);
        });

        _kiwi.app.view.doLayout();
    },

    updateTabTitle: function (panel, new_title) {
        $('span', panel.tab).text(new_title);
    },

    panelAdded: function (panel) {
        // Add a tab to the panel
        panel.tab = $('<li><span>' + (panel.get('title') || panel.get('name')) + '</span><div class="activity"></div></li>');

        if (panel.isServer()) {
            panel.tab.addClass('server');
            panel.tab.addClass('fa');
            panel.tab.addClass('fa-nonexistant');
        }

        panel.tab.data('panel', panel);

        if (this.is_network)
            panel.tab.data('connection_id', this.model.network.get('connection_id'));

        this.sortTabs();

        panel.bind('change:title', this.updateTabTitle);
        panel.bind('change:name', this.updateTabTitle);

        //Adding a panel
        this.panel_access.unshift(panel.cid);

        _kiwi.app.view.doLayout();
    },
    panelRemoved: function (panel) {
        var connection = _kiwi.app.connections.active_connection;

        panel.tab.remove();

        // If closing the active panel, switch to the last-accessed panel
        if (this.panel_access[0] === _kiwi.app.panels().active.cid) {
            this.panel_access.shift();

            //Get the last-accessed panel model now that we removed the closed one
            var model = connection.panels.getByCid(this.panel_access[0]);

            if (model) {
                model.view.show();
            }
        }

        delete panel.tab;

        _kiwi.app.view.doLayout();
    },

    panelActive: function (panel, previously_active_panel) {
        var panel_index = _.indexOf(this.panel_access, panel.cid);

        // Remove any existing tabs or part images
        _kiwi.app.view.$el.find('.panellist .part').remove();
        _kiwi.app.view.$el.find('.panellist .active').removeClass('active');

        panel.tab.addClass('active');

        // Only show the part image on non-server tabs
        if (!panel.isServer()) {
            panel.tab.append('<span class="part fa fa-nonexistant"></span>');
        }

        if (panel_index > -1) {
            this.panel_access.splice(panel_index, 1);
        }

        //Make this panel the most recently accessed
        this.panel_access.unshift(panel.cid);
    },

    tabClick: function (e) {
        var tab = $(e.currentTarget);

        var panel = tab.data('panel');
        if (!panel) {
            // A panel wasn't found for this tab... wadda fuck
            return;
        }

        panel.view.show();
    },

    partClick: function (e) {
        var tab = $(e.currentTarget).parent();
        var panel = tab.data('panel');

        if (!panel) return;

        // Only need to part if it's a channel
        // If the nicklist is empty, we haven't joined the channel as yet
        if (panel.isChannel() && panel.get('members').models.length > 0) {
            this.model.network.gateway.part(panel.get('name'));
        } else {
            panel.close();
        }
    },

    sortTabs: function() {
        var that = this,
            panels = [];

        this.model.forEach(function (panel) {
            // Ignore the server tab, so all others get added after it
            if (that.is_network && panel == that.model.server)
                return;

            panels.push([panel.get('title') || panel.get('name'), panel]);
        });

        // Sort by the panel name..
        panels.sort(function(a, b) {
            if (a[0].toLowerCase() > b[0].toLowerCase()) {
                return 1;
            } else if (a[0].toLowerCase() < b[0].toLowerCase()) {
                return -1;
            } else {
                return 0;
            }
        });

        // And add them all back in order.
        _.each(panels, function(panel) {
            panel[1].tab.appendTo(that.$el);
        });
    }
});
});
_kiwi.model.Panel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "";
        this.view = new _kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});
    },

    closePanel: function () {
        console.log("Closing panel");
        if (this.view) {
            this.view.unbind();
            this.view.remove();
            this.view = undefined;
            delete this.view;
        }

        var members = this.get('members');
        if (members) {
            members.reset([]);
            this.unset('members');
        }

        this.get('panel_list').remove(this);

        this.unbind();
        this.destroy();

        // If closing the active panel, switch to the last-accessed panel
        if (this === _kiwi.app.panels().active) {
            _kiwi.app.panel_access.shift();

            var modelsList = _kiwi.app.connections.active_connection.panels.models;
            //Since it always has at least one tab, just go to the 0th element
            for (var i=0; i < modelsList.length;i++) {
                if (modelsList[i].cid === _kiwi.app.panel_access[0]) {
                    console.log("Yap");
                    modelsList[i].view.show();
                }
            }
        }
    },

    // Alias to closePanel() for child objects to override
    close: function () {
        return this.closePanel();
    },

    isChannel: function () {
        var channel_prefix = _kiwi.gateway.get('channel_prefix'),
            this_name = this.get('name');

        if (this.isApplet() || !this_name) return false;
        return (channel_prefix.indexOf(this_name[0]) > -1);
    },

    isQuery: function () {
        if (!this.isChannel() && !this.isApplet() && !this.isServer()) {
            return true;
        }

        return false;
    },

    isApplet: function () {
        return this.applet ? true : false;
    },

    isServer: function () {
        return this.server ? true : false;
    },

    isActive: function () {
        return (_kiwi.app.panels().active === this);
    }
});
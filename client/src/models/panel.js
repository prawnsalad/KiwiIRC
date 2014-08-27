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
    },

    // Alias to closePanel() for child objects to override
    close: function () {
        return this.closePanel();
    },

    isChannel: function () {
        return false;
    },

    isLocked: function() {
        return false;
    },

    isQuery: function () {
        return false;
    },

    isApplet: function () {
        return false;
    },

    isServer: function () {
        return false;
    },

    isActive: function () {
        return (_kiwi.app.panels().active === this);
    }
});

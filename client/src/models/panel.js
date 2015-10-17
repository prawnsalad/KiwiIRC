_melon.model.Panel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "";
        this.view = new _melon.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        _melon.global.events.emit('panel:created', {panel: this});
    },

    close: function () {
        _melon.app.panels.trigger('close', this);
        _melon.global.events.emit('panel:close', {panel: this});

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

    isChannel: function () {
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
        return (_melon.app.panels().active === this);
    }
});
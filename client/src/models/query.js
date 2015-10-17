_melon.model.Query = _melon.model.Channel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.view = new _melon.view.Channel({"model": this, "name": name});
        this.set({
            "name": name,
            "scrollback": []
        }, {"silent": true});

        _melon.global.events.emit('panel:created', {panel: this});
    },

    isChannel: function () {
        return false;
    },

    isQuery: function () {
        return true;
    }
});
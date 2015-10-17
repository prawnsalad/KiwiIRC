_melon.model.Server = _melon.model.Channel.extend({
    initialize: function (attributes) {
        var name = "Server";
        this.view = new _melon.view.Channel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        _melon.global.events.emit('panel:created', {panel: this});
    },

    isServer: function () {
        return true;
    },

    isChannel: function () {
        return false;
    }
});
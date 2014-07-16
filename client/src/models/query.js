_kiwi.model.Query = _kiwi.model.Channel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.view = new _kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "name": name,
            "scrollback": []
        }, {"silent": true});
    },

    isChannel: function () {
        return false;
    },

    isQuery: function () {
        return true;
    }
});
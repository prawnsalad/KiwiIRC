kiwi.model.Query = kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.view = new kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "name": name,
            "scrollback": []
        }, {"silent": true});
    }
});
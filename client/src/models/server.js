_kiwi.model.Server = _kiwi.model.Channel.extend({
    initialize: function (attributes) {
        var name = "Server";
        this.view = new _kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        //this.addMsg(' ', '--> Kiwi IRC: Such an awesome IRC client', '', {style: 'color:#009900;'});
    },

    isServer: function () {
        return true;
    },

    isChannel: function () {
        return false;
    }
});
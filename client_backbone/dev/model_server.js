kiwi.model.Server = kiwi.model.Panel.extend({
    // Used to determine if this is a server panel
    server: true,

    server_login: null,

    initialize: function (attributes) {
        var name = "Server";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        //this.addMsg(' ', '--> Kiwi IRC: Such an awesome IRC client', '', {style: 'color:#009900;'});

        this.server_login = new kiwi.view.ServerSelect();
        
        this.view.$el.append(this.server_login.$el);
        this.server_login.show();
    }
});
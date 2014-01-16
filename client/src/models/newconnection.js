_kiwi.model.NewConnection = Backbone.Collection.extend({
    initialize: function() {
        this.view = new _kiwi.view.ServerSelect();

        this.view.bind('server_connect', this.onMakeConnection, this);

    },


    onMakeConnection: function(new_connection_event) {
        var that = this,
            transport_path = '',
            auto_connect_details = new_connection_event;

        this.view.networkConnecting();

        // If not connected already, connect then send the IRC connect info
        if (!_kiwi.gateway.isConnected()) {
            _kiwi.gateway.connect(function() {
                that.makeConnection(new_connection_event);
            });

        } else {
            this.makeConnection(new_connection_event);
        }


    },


    onKiwiServerNotFound: function() {
        this.view.showError();
    },


    makeConnection: function(new_connection_event) {
        var that = this;

        this.connect_details = new_connection_event;

        _kiwi.gateway.newConnection({
            nick: new_connection_event.nick,
            host: new_connection_event.server,
            port: new_connection_event.port,
            ssl: new_connection_event.ssl,
            password: new_connection_event.password,
            options: new_connection_event.options,
            age: new_connection_event.age,
            gender: new_connection_event.gender,
            location: new_connection_event.location
        }, function(err, network) {
            that.onNewNetwork(err, network);
        });
    },


    onNewNetwork: function(err, network) {
        // Show any errors if given
        if (err) {
            this.view.showError(err);
        }

        if (network && this.connect_details) {
            network.auto_join = {
                channel: this.connect_details.channel,
                key: this.connect_details.channel_key
            };
        }


        // Show the server panel if this is our first network
        if (network && network.get('connection_id') === 0) {
            network.panels.server.view.show();
        }
    }
});
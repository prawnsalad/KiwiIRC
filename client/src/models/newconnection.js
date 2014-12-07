_kiwi.model.NewConnection = Backbone.Collection.extend({
    initialize: function() {
        this.view = new _kiwi.view.ServerSelect({model: this});

        this.view.bind('server_connect', this.onMakeConnection, this);

    },


    populateDefaultServerSettings: function() {
        var defaults = _kiwi.global.defaultServerSettings();
        var previous = {};
        try {
            var str = localStorage.getItem('login_cached_values');
            if (str) {
                previous = JSON.parse(str);
            }
        } catch (error) {
        }


        this.view.populateFields(defaults, previous);
    },


    onMakeConnection: function(new_connection_event) {
        var that = this;

        this.connect_details = new_connection_event;

        this.view.networkConnecting();

        _kiwi.gateway.newConnection({
            nick: new_connection_event.nick,
            host: new_connection_event.server,
            port: new_connection_event.port,
            ssl: new_connection_event.ssl,
            password: new_connection_event.password,
            options: new_connection_event.options
        }, function(err, network) {
            that.onNewNetwork(err, network);
        });


        localStorage.setItem('login_cached_values', JSON.stringify({
            nick: new_connection_event.nick,
            server: new_connection_event.server,
            port: new_connection_event.port,
            ssl: new_connection_event.ssl,
            password: new_connection_event.password,
            channel: new_connection_event.channel,
            channel_key: new_connection_event.channel_key,
            options: new_connection_event.options
        }));
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

            this.trigger('new_network', network);
        }
    }
});

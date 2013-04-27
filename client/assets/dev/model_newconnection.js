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

        
        // If we don't have socket.io loaded, load it before opening a new connection
        if (!window.io) {
            // Path to get the socket.io transport code
            transport_path = _kiwi.app.kiwi_server + _kiwi.app.get('base_path') + '/transport/socket.io.js?ts='+(new Date().getTime());
                        
            $script(transport_path, function() {
                if (!window.io) {
                    that.onKiwiServerNotFound();
                    return;
                }

                _kiwi.gateway.set('kiwi_server', _kiwi.app.kiwi_server + '/kiwi');
                _kiwi.gateway.connect(function() {
                    that.makeConnection(new_connection_event);
                });
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

        _kiwi.gateway.newConnection({
            nick: new_connection_event.nick,
            host: new_connection_event.server,
            port: new_connection_event.port,
            ssl: new_connection_event.ssl,
            password: new_connection_event.password
        }, function(err, network) {
            that.onNewNetwork(err, network);
        });
    },


    onNewNetwork: function(err, network) {
        // Show the server panel if this is our first network
        if (network && network.get('connection_id') === 0) {
            network.panels.server.view.show();
        }
    }
});
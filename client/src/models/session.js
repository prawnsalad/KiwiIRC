_kiwi.model.Session = Backbone.Model.extend({
	initialize: function() {
	},


	save: function(username, password) {
		var that = this;

		var fn = function(err, data) {
			that.trigger('save', err, data);
		};

        _kiwi.gateway.rpc.call('kiwi.session_save', {
            username: username,
            password: password,
        }, fn);
	},


	resume: function(username, password) {
		var that = this;

        var fn = function() {
            _kiwi.gateway.rpc.call('kiwi.session_resume', {
                username: username,
                password: password,
            }, _.bind(that.resumeCallback, that));
        };

        if (_kiwi.gateway.isConnected()) {
            fn();
        } else {
            _kiwi.gateway.connect(fn);
        }
	},


	syncEvents: function(network_id, target) {
        if (target && !callback) {
            callback = target;
            target = undefined;
        }

        _kiwi.gateway.rpc.call('kiwi.session_events', {
            connection_id: network_id,
            target: target,
        });
	},


	resumeCallback: function(err, data) {
		if (err) {
			this.trigger('resumed', err, data);
			return;
		}

        // For each connection, create the network object and channels
        _.each(data, function(connection) {
            var new_connection,
                inf = {
                    connection_id: connection.connection_id,
                    nick: connection.nick,
                    address: connection.host,
                    port: connection.port,
                    ssl: connection.ssl
                };

            new_connection = new _kiwi.model.Network(inf);
            _kiwi.gateway.trigger('connection:' + connection.connection_id.toString(), {
                event_name: 'options',
                event_data: {options: connection.options.options, cap: connection.options.cap}
            });

            _kiwi.app.connections.add(new_connection);

            _.each(connection.channels, function(channel_info, idx) {
                var channel = new_connection.panels.getByName(channel_info.name);

                if (!channel) {
                    channel = new _kiwi.model.Channel({name: channel_info.name, network: new_connection});
                    new_connection.panels.add(channel);
                }
            });

            // Let the application know we have connected to an IRCd
            _kiwi.gateway.trigger('connect', {
                server: connection.connection_id,
                nick: connection.nick
            });
        });

		this.trigger('resumed', err, data);
	}
});
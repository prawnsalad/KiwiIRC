var kiwiModules = require('../server/modules');

var module = new kiwiModules.Module('auth/static');

module.on('auth attempt', function(event, event_data) {
	console.log('Attempted auth', event_data);

	var users = {
		darren: '1234'
	};

	if (
		!users[event_data.credentials.username] ||
		users[event_data.credentials.username] !== event_data.credentials.password
	) {
		return;
	}

	event_data.success = true;
	event_data.user_id = event_data.credentials.username;
});
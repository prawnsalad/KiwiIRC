/**
 * Temporarily creating passwords:
 *     $ npm install bcrypt-nodejs
 *     $ node -e "console.log(require('bcrypt-nodejs').hashSync('your_password'));"
 *
 * Installation into existing persistence user table:
 *     ALTER TABLE users ADD COLUMN password VARCHAR(70);
 */

var kiwiModules = require('../../server/modules');
var mysql = require('mysql');
var bcrypt = require("bcrypt-nodejs");

// should probably be moved to config.js since it's used multiple places
var db = mysql.createConnection({
  host     : 'dev.local',
  user     : 'root',
  password : '1234',
  database : 'kiwi_bnc'
});

var module = new kiwiModules.Module('auth/mysql');

module.on('auth attempt', function(event, event_data) {
	console.log('Attempted auth', event_data);

	// Tell kiwi to wait for our callback
	event.wait = true;

	var query = "SELECT * FROM users WHERE id = ?";
	db.query(query, [event_data.credentials.username], function (err, rows) {
		if (err) {
			console.log("Something awful happened with the database: " + err.message);
			return  event.callback();
		}
		if (rows === null || rows[0] === undefined) {
			return event.callback();
		}

		bcrypt.compare(event_data.credentials.password, rows[0]['password'], function(err, res) {
			if (res) {
				event_data.success = true;
				event_data.user_id = event_data.credentials.username;
			}

			event.callback();
		});
	});
});
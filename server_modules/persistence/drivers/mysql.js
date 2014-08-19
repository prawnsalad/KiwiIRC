/*
CREATE TABLE `events` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `state_id` varchar(100) DEFAULT NULL,
  `target` varchar(60) DEFAULT NULL,
  `event` text,
  PRIMARY KEY (`id`),
  KEY `state_id` (`state_id`)
) ENGINE=InnoDB;


CREATE TABLE `users` (
  `id` varchar(10) NOT NULL DEFAULT '',
  `state_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

== TODO
When inserting a state_id, put state_id in its own table and use its int id column
for the user + states column. Should save a lot of index and disk space
*/

var mysql      = require('mysql');
var db = mysql.createConnection({
  host     : 'dev.local',
  user     : 'root',
  password : '1234',
  database : 'kiwi_bnc'
});


var StorageMemory = module.exports = function StorageMemory() {
    db.connect();
};


StorageMemory.prototype.userExists = function(user_id, callback) {
    db.query('SELECT 1 FROM users WHERE id = ?', [user_id], function(err, rows) {
        callback(rows.length > 0);
    });
};


StorageMemory.prototype.getUserState = function(user_id, callback) {
    db.query('SELECT state_id FROM users WHERE id = ?', [user_id], function(err, rows) {
        if (err) {
            console.log(err);
            return callback(false);
        }

        if (!rows || rows.length === 0) {
            return callback(false);
        }

        var state_id = rows[0].state_id;

        state = global.states.getState(state_id);
        if (!state)
            return callback(false);

        return callback(state);
    });
};


StorageMemory.prototype.setUserState = function(user_id, state, callback) {
    var row = {
        id: user_id,
        state_id: state.hash
    };

    db.query('INSERT INTO users SET ? ON DUPLICATE KEY UPDATE state_id = ?', [row, state.hash], function(err, result) {
        if (err) {
            console.log(err);
            return callback(false);
        }

        callback();
    });
};


StorageMemory.prototype.putStateEvent = function(state_id, target, event, callback) {
    var row = {
        state_id: state_id,
        created_at: new Date(),
        target: target.toLowerCase(),
        event: JSON.stringify(event)
    };

    db.query('INSERT INTO events SET ?', row, function(err, result) {
        console.log('added event for', target, event);
        return callback ? callback() : null;
    });
};


StorageMemory.prototype.getStateEvents = function(state_id, target, callback) {
    var sql = 'SELECT * FROM events WHERE state_id = ? AND target = ? ORDER BY created_at DESC limit 50';
    db.query(sql, [state_id, target.toLowerCase()], function(err, result) {
        var events = [];
        result.forEach(function(row) {
            events.push(JSON.parse(row.event));
        });

        callback(events);
    });
};


StorageMemory.prototype.getTargets = function(state_id, callback) {
    var sql = 'SELECT target FROM events WHERE state_id = ? GROUP BY target ORDER BY MAX(created_at)';
    db.query(sql, [state_id], function(err, result) {
        var targets = [];
        result.forEach(function(row) {
            targets.push(row.target);
        });

        callback(targets);
    });
};

/*
CREATE TABLE `events` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT NULL,
  `state_id` varchar(100) DEFAULT NULL,
  `connection_id` int(11) unsigned DEFAULT NULL,
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

var _ = require('lodash'),
    Promise = require('es6-promise').Promise;


var StorageMemory = module.exports = function StorageMemory() {
    this.user_state = {};  // {state_hash: user_id}
    this.users = {};  // {user_id: {state_id:'', connections:[]}}
};

/*
    users =  {
        state_id: 'state_id',
        connections: [
            {connection_id, host, port, events:{target:[], target1:[]}},
            {connection_id, host, port, events:{target:[], target1:[]}}
        ]
    }
*/

// Return a state_id or false if it does not exist
StorageMemory.prototype.getUserState = function(user_id) {
    var that = this;
console.log('within getUserState()');
    return new Promise(function(resolve, reject) {
        console.log('calling db');
        db.query('SELECT state_id FROM users WHERE id = ?', [user_id], function(err, rows) {
            console.log(err, rows);
            if (err) {
                console.log(err);
                return resolve(false);
            }

            if (!rows || rows.length === 0) {
                return resolve(false);
            }

            return resolve(rows[0].state_id);
        });
    });
};


StorageMemory.prototype.setUserState = function(user_id, state_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var row = {
            id: user_id,
            state_id: state_id
        };

        db.query('INSERT INTO users SET ? ON DUPLICATE KEY UPDATE state_id = ?', [row, state_id], function(err, result) {
            if (err) {
                console.log(err);
                return resolve(false);
            }

            resolve();
        });
    });
};


// Return an array of objects, each with connection info
//[
//  {con_id:0, host:'irc.host.com', port:111, nick:'sum'},
//  {con_id:1, host:'irc.host2.com', port:111, nick:'sum'}
//]
StorageMemory.prototype.getUserConnections = function(user_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var sql = 'SELECT connections.* FROM connections ';
        sql += 'INNER JOIN users ON users.state_id = connections.state_id ';
        sql += 'WHERE users.id = ?';

        db.query(sql, [user_id], function(err, rows) {
            if (err) {
                console.log(err);
                return resolve(false);
            }

            if (!rows || rows.length === 0) {
                return resolve(false);
            }

            var cons = [];

            rows.forEach(function(con) {
                cons.push({
                    connection_id: con.id,
                    host: con.host,
                    port: con.port,
                    ssl: con.ssl,
                    nick: con.nick,
                    gecos: con.gecos
                });
            });

            resolve(cons);
        });
    });
};


StorageMemory.prototype.setUserConnections = function(state_id, connections) {
    return new Promise(function(resolve, reject) {
        var sql = 'INSERT INTO connections ';
        sql += '(`state_id`, `id`, `host`, `port`, `ssl`, `nick`, `gecos`) VALUES ? ';
        sql += 'ON DUPLICATE KEY UPDATE ';
        sql += '`host`=VALUES(`host`), `port`=VALUES(`port`), `ssl`=VALUES(`ssl`), ';
        sql += '`nick`=VALUES(`nick`), `gecos`=VALUES(`gecos`) ';

        var insert = [];
console.log('setting user connections', connections);
        _.each(connections, function(con) {
            insert.push([
                state_id,
                con.connection_id,
                con.host,
                con.port,
                con.ssl,
                con.nick,
                con.gecos
            ]);
        });

        var q = db.query(sql, [insert], function(err, result) {
            console.log('inserted', err, result);
            resolve();
        });
        console.log(q.sql);
    });
};


// Return array of client events. If length < 0, get previous events
StorageMemory.prototype.getEvents = function(state_id, connection_id, target_name, from_time, length) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var sql = 'SELECT * FROM events WHERE ';
        sql += 'state_id = ? AND connection_id = ? AND target = ? ';
        sql += 'ORDER BY created_at DESC limit 50';

        db.query(sql, [state_id, connection_id, target_name.toLowerCase()], function(err, result) {
            var events = [];
            result.forEach(function(row) {
                events.push(JSON.parse(row.event));
            });

            return resolve(events);
        });
    });
};


StorageMemory.prototype.putEvent = function(state_id, connection_id, target_name, event) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var row = {
            state_id: state_id,
            connection_id: connection_id,
            created_at: new Date(),
            target: target_name.toLowerCase(),
            event: JSON.stringify(event)
        };

        db.query('INSERT INTO events SET ?', row, function(err, result) {
            console.log('added event for', target_name, event);
            resolve();
        });
    });
};


StorageMemory.prototype.getTargets = function(state_id, connection_id) {
    var that = this;

    return new Promise(function(resolve, reject) {
        var sql = 'SELECT target FROM events WHERE state_id = ? AND connection_id = ? GROUP BY target ORDER BY MAX(created_at)';
        db.query(sql, [state_id, connection_id], function(err, result) {
            var targets = [];
            result.forEach(function(row) {
                targets.push(row.target);
            });

            resolve(targets);
        });
    });
};

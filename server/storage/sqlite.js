var sqlite3 = require('sqlite3'),
    _ = require('lodash');







function StorageSqlite(max_events) {
    this.max_events = max_events;

    this.db = new sqlite3.Database('storage.sqlite3')
    this.initDb();
}
module.exports = StorageSqlite;


// Create the database structure
StorageSqlite.prototype.initDb = function() {
    var that = this;

    this.db.serialize(function () {
        var sql,
            tables = {
            users: {
                id: 'INTEGER PRIMARY KEY',
                username: 'TEXT',
                password: 'TEXT'
            },

            states: {
                id: 'INTEGER PRIMARY KEY',
                user_id: 'INTEGER',
                hash: 'TEXT',
                created: 'INTEGER',
            },

            connections: {
                id: 'INTEGER PRIMARY KEY',
                num: 'INTEGER',     // irc_connection.con_num
                user_id: 'INTEGER',
                hash_id: 'INTEGER',
                obj: 'TEXT',
                created: 'INTEGER'
            },

            channels: {
                id: 'INTEGER PRIMARY KEY',
                hash_id: 'INTEGER',
                connection_id: 'INTEGER',
                name: 'TEXT',
                obj: 'TEXT'
            },

            events: {
                id: 'INTEGER PRIMARY KEY',
                connection_id: 'INTEGER',
                channel_id: 'INTEGER',
                created: 'INTEGER',
                name: 'TEXT',
                obj: 'TEXT'
            }
        };


        _.each(tables, function (columns, table_name) {
            var sql, column_definitions = [];
            _.each(columns, function (definition, column_name) {
                column_definitions.push(column_name + ' ' + definition );
            });

            sql = 'CREATE TABLE IF NOT EXISTS ' + table_name + ' (';
            sql += column_definitions.join(', ');
            sql += ');';
            that.db.run(sql);
        });
    });
};



StorageSqlite.prototype.getStates = function(username, callback) {
    var sql = '';
    sql += 'SELECT states.hash ';
    sql += 'FROM states ';
    sql += 'LEFT JOIN users ON users.id = states.user_id ';
    sql += 'WHERE users.username = ? ';

    this.db.all(sql, [username], function (err, rows) {
        var result = [];
        _.each(rows, function (row) {
            result.push(row.hash);
        });

        callback(result);
    });
};



StorageSqlite.prototype.getConnections = function(state_hash, callback) {
    var sql = '';
    sql += 'SELECT cons.obj ';
    sql += 'FROM connections cons ';
    sql += 'LEFT JOIN states ON states.id = cons.hash_id ';
    sql += 'WHERE states.hash = ? ';

    this.db.all(sql, [state_hash], function (err, rows) {
        var result = [];
        _.each(rows, function (row) {
            result.push(JSON.parse(row.obj));
        });

        callback(result);
    });
};



StorageSqlite.prototype.getChannels = function(state_hash, connection_num, callback) {
    var sql = '';
    sql += 'SELECT chan.obj ';
    sql += 'FROM channels chan ';
    sql += 'LEFT JOIN connections cons ON cons.id = chan.connection_id ';
    sql += 'LEFT JOIN states ON states.id = cons.hash_id ';
    sql += 'WHERE states.hash = ? AND cons.num = ? ';

    this.db.all(sql, [state_hash, connection_num], function (err, rows) {
        var result = [];
        _.each(rows, function (row) {
            result.push(JSON.parse(row.obj));
        });

        callback(result);
    });
};



StorageSqlite.prototype.getEvents = function(state_hash, connection_num, channel_name, callback) {
    var sql = '';
    sql += 'SELECT events.obj, events.name ';
    sql += 'FROM events ';
    sql += 'LEFT JOIN connections cons ON cons.id = events.connection_id ';
    sql += 'LEFT JOIN states ON states.id = cons.hash_id ';
    sql += 'LEFT JOIN channels ON channels.id = events.channel_id ';
    sql += 'WHERE states.hash = ? AND cons.num = ? AND channels.name LIKE ? ';
    sql += 'ORDER BY events.created ';

    this.db.all(sql, [state_hash, connection_num, channel_name], function (err, rows) {
        var result = [];
        _.each(rows, function (row) {
            result.push({
                name: row.name,
                obj: JSON.parse(row.obj)
            });
        });

        callback(result);
    });
};



StorageSqlite.prototype.putState = function(username, state_hash, callback) {
    var that = this;

    this.db.get('SELECT id FROM users WHERE username LIKE ?', [username], function(err, row) {
        console.log('putState() args:', arguments);
        if (!row) return (callback && callback('user_not_found')) || undefined;

        that.db.run('INSERT INTO states (user_id, hash, created) VALUES (?, ?, ?)', [
            row.id,
            state_hash,
            (new Date()).getTime()
        ], callback);
    });
};



StorageSqlite.prototype.putConnection = function(state_hash, connection_num, connection_obj, callback) {
    var that = this;
    var sql = '';

    sql += 'SELECT users.id AS user_id, states.id AS hash_id ';
    sql += 'FROM users ';
    sql += 'LEFT JOIN states ON users.id = states.user_id ';
    sql += 'WHERE states.hash = ? ';

    this.db.get(sql, [state_hash], function(err, row) {
        console.log('putConnection() args:', arguments);
        if (!row) return (callback && callback('state_not_found')) || undefined;

        that.db.run('INSERT INTO connections (user_id, hash_id, num, obj, created) VALUES (?, ?, ?, ?, ?)', [
            row.user_id,
            row.hash_id,
            connection_num,
            JSON.stringify(connection_obj),
            (new Date()).getTime()
        ], callback);
    });
};



StorageSqlite.prototype.putChannel = function(state_hash, connection_num, channel_name, channel_obj, callback) {
    var that = this;
    var sql = '';

    sql += 'SELECT states.id AS hash_id, cons.id as con_id ';
    sql += 'FROM states ';
    sql += 'LEFT JOIN connections cons ON states.id = cons.hash_id ';
    sql += 'WHERE states.hash LIKE ? AND cons.num = ?';

    this.db.get(sql, [state_hash, connection_num], function(err, row) {
        console.log('putChannel()', connection_num, 'args:', arguments);
        if (!row) return (callback && callback()) || undefined;

        that.db.run('INSERT INTO channels (hash_id, connection_id, name, obj) VALUES (?, ?, ?, ?)', [
            row.hash_id,
            row.con_id,
            channel_name,
            JSON.stringify(channel_obj)
        ], callback);
    });
};



StorageSqlite.prototype.putEvent = function(state_hash, connection_num, channel_name, event_name, event_obj, callback) {
    var that = this;
    var sql = '';

    sql += 'SELECT cons.id AS con_id, channels.id AS chan_id ';
    sql += 'FROM connections cons ';
    sql += 'LEFT JOIN channels ON cons.id = channels.connection_id ';
    sql += 'LEFT JOIN states ON states.id = cons.hash_id ';
    sql += 'WHERE states.hash = ? AND cons.num = ? AND channels.name LIKE ? ';
    sql += 'LIMIT 1 ';

    this.db.get(sql, [state_hash, connection_num, channel_name], function(err, row) {
        console.log('putEvent() args:', arguments);
        if (!row) return (callback && callback()) || undefined;

        that.db.run('INSERT INTO events (connection_id, channel_id, created, name, obj) VALUES (?, ?, ?, ?, ?)', [
            row.con_id,
            row.chan_id,
            (new Date()).getTime(),
            event_name,
            JSON.stringify(event_obj)
        ], callback);
    });
};



StorageSqlite.prototype.dispose = function() {};



StorageSqlite.prototype.delState = function(username, state_hash, callback) { };
StorageSqlite.prototype.delConnection = function(state_hash, connection_num, callback) { };
StorageSqlite.prototype.delChannel = function(state_hash, connection_num, channel_name, callback) { };
StorageSqlite.prototype.delEvents = function(state_hash, connection_num, channel_name, callback) { };



/*

var f = new StorageSqlite();
//f.putState('darren', 'my_hash', console.log);
//f.putConnection('my_hash', 1, {con_num:1, foo:'bar', bar:1}, console.log);
//f.putChannel('my_hash', 1, '#dev', {name:'#dev',topic:'mysqldev',modes:'Ctk'}, console.log);
//f.putEvent('my_hash', 1, '#kiwiirc', {nick: 'prawn', msg:'hiyaaaa', channel:'#kiwiirc'}, console.log);


f.getStates('darren', function (state_hashes) {
    _.each(state_hashes, function(state_hash) {
        console.log('-- state_hash', state_hash);

        f.getConnections(state_hash, function (connections) {
            console.log('   ', connections);

            _.each(connections, function(connection) {
                f.getChannels(state_hash, connection.con_num, function (channels) {
                    console.log('      Channels:', channels);

                    _.each(channels, function(channel) {
                        //console.log('              ', channel.name);

                        f.getEvents(state_hash, connection.con_num, channel.name, function (event) {
                            console.log('          Events (', channel.name, ')', event);
                        });
                    });
                });
            });
        });
    });
});
*/
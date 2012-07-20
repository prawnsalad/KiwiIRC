var fs          = require('fs'),
    WebListener = require('./web.js').WebListener;

//load config

var config_filename = 'config.json',
    config_dirs = ['/etc/kiwiirc/', __dirname + '/'];

var config = Object.create(null);
for (var i in config_dirs) {
    try {
        if (fs.lstatSync(config_dirs[i] + config_filename).isDirectory() === false) {
            config = JSON.parse(fs.readFileSync(config_dirs[i] + config_filename, 'utf-8'));
            console.log('Loaded config file ' + config_dirs[i] + config_filename);
            break;
        }
    } catch (e) {
        switch (e.code) {
        case 'ENOENT':      // No file/dir
            break;
        default:
            console.log('An error occured parsing the config file ' + config_dirs[i] + config_filename + ': ' + e.message);
            return false;
        }
        continue;
    }
}

if (Object.keys(config).length === 0) {
    console.log('Couldn\'t find a valid config file!');
    process.exit(1);
}

if ((!config.servers) || (config.servers.length < 1)) {
    console.log('No servers defined in config file');
    process.exit(2);
}

//Create web listeners

var clients = [];
_.each(config.servers, function (server) {
    var wl = new WebListener(server, config.transports);
    wl.on('connection', function (client) {
        clients.push(client);
    });
    wl.on('destroy', function (client) {
        clients = _.reject(clients, function (c) {
            return client === c;
        });
    });
});


//Set process title
process.title = 'Kiwi IRC';

//Change UID/GID
if ((config.user) && (config.user !== '')) {
    process.setuid(config.user);
}
if ((config.group) && (config.group !== '')) {
    process.setgid(config.group);
}

//Listen to STDIN
process.stdin.resume();
process.stdin.on('data', function (data) {
    console.log(data.toString());
});

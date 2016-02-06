var fs      = require('fs'),
    events  = require('events'),
    util    = require('util'),
    path    = require('path'),
    winston = require('winston');

var config_filename = 'config.js',
    config_dirs = ['/etc/kiwiirc/', __dirname + '/../'],
    environment = 'production',
    loaded_config = Object.create(null);

var Config = function () {
    events.EventEmitter.call(this);
};
util.inherits(Config, events.EventEmitter);

Config.prototype.loadConfig = function (manual_config_file) {
    var that = this,
        new_config,
        new_config_filename,
        conf_filepath,
        i;

    manual_config_file = manual_config_file || this.manual_config_file;

    if (manual_config_file) {
        if (manual_config_file.substr(0, 2) === '$ ') {
            return loadExecutedConfig(manual_config_file.substr(2))
                .then(loadFromFile)
                .then(function() {
                    // Save location of configuration file so that we can re-load it later
                    that.manual_config_file = manual_config_file;
                });

        } else {
            return Promise.resolve(path.resolve(path.normalize(manual_config_file)))
                .then(loadFromFile)
                .then(function() {
                    // Save location of configuration file so that we can re-load it later
                    that.manual_config_file = manual_config_file;
                });
        }

    } else {
        // Loop through the possible config paths and find a usable one
        for (i = 0; i < config_dirs.length; i++) {
            conf_filepath = config_dirs[i] + config_filename;

            try {
                if (fs.lstatSync(conf_filepath).isFile() === true) {
                    return Promise.resolve(conf_filepath)
                        .then(loadFromFile);
                }
            } catch (e) {
                switch (e.code) {
                case 'ENOENT':      // No file/dir
                    break;
                default:
                    winston.warn('An error occured parsing the config file %s%s: %s', config_dirs[i], config_filename, e.message);
                    return false;
                }
                continue;
            }
        }
    }


    function loadFromFile(file_name) {
        if (!fs.existsSync(file_name)) {
            winston.error('Could not find config file %s', manual_config_file);
            throw new Error('Error finding the config file');
        }

        try {
            if (fs.lstatSync(file_name).isFile() === true) {
                // Clear the loaded config cache
                delete require.cache[require.resolve(file_name)];

                // Try load the new config file
                new_config = require(file_name);
                new_config_filename = file_name;

                // All was good, set references to this new config
                loaded_config = new_config;
                global.config = new_config[environment] || {};
                global.config.resolvePath = resolvePathFn(new_config_filename);
                that.emit('loaded');
            }
        } catch (e) {
            winston.error('An error occured parsing the config file %s: %s', manual_config_file, e.message);
            throw new Error('Error parsing the config file');
        }
    }
};



Config.prototype.setEnvironment = function (new_environment) {
    environment = new_environment;
};

// Get the current config. Optionally for a different environment than currently set
Config.prototype.get = function (specific_environment) {
    specific_environment = specific_environment || environment;

    return loaded_config[specific_environment] || {};
};

module.exports = new Config();



function resolvePathFn(config_path) {
    var config_dir = path.dirname(config_path);

    return function(resolve_path) {
        return path.resolve(config_dir, resolve_path);
    };
}


function loadExecutedConfig(input) {
    if (!input) {
        return input;
    }

    return new Promise(function(resolve, reject) {
        var child_process = require('child_process');
        var fs = require('fs');
        var os = require('os');

        var tmp_file = os.tmpdir() + '/kiwi_' + Date.now() + '.js';
        winston.info('Executing shell command `%s` and saving to temporary `%s`', input, tmp_file);

        child_process.exec(input, function(err, stdout, stdin) {
            if (err) {
                throw new Error(err);
            }

            fs.writeFileSync(tmp_file, stdout);
            resolve(tmp_file);
        });
    });
}
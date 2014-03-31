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
    var new_config,
        conf_filepath,
        i;

    if ((manual_config_file) || (this.manual_config_file)) {
        manual_config_file =  path.resolve(path.normalize(manual_config_file || this.manual_config_file));
        if (fs.existsSync(manual_config_file)) {
            try {
                if (fs.lstatSync(manual_config_file).isFile() === true) {
                    // Clear the loaded config cache
                    delete require.cache[require.resolve(manual_config_file)];

                    // Try load the new config file
                    new_config = require(manual_config_file);

                    // Save location of configuration file so that we can re-load it later
                    this.manual_config_file = manual_config_file;
                }
            } catch (e) {
                winston.error('An error occured parsing the config file %s: %s', manual_config_file, e.message);
                process.exit(1);
            }
        } else {
            winston.error('Could not find config file %s', manual_config_file);
            process.exit(1);
        }
    } else {
        // Loop through the possible config paths and find a usable one
        for (i = 0; i < config_dirs.length; i++) {
            conf_filepath = config_dirs[i] + config_filename;

            try {
                if (fs.lstatSync(conf_filepath).isFile() === true) {
                    // Clear the loaded config cache
                    delete require.cache[require.resolve(conf_filepath)];

                    // Try load the new config file
                    new_config = require(conf_filepath);
                    break;
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

    if (new_config) {
        loaded_config = new_config;
        global.config = new_config[environment] || {};
        this.emit('loaded');
        return loaded_config;
    } else {
        return false;
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

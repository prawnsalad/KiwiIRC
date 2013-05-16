var fs = require('fs');

var config_filename = 'config.js',
    config_dirs = ['/etc/kiwiirc/', __dirname + '/../'],
    environment = 'production',
    loaded_config = Object.create(null);


function loadConfig() {
    var new_config,
        conf_filepath,
        i;

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
                console.log('An error occured parsing the config file ' + config_dirs[i] + config_filename + ': ' + e.message);
                return false;
            }
            continue;
        }
    }

    if (new_config) {
        loaded_config = new_config;
        global.config = new_config[environment] || {};
        return loaded_config;
    } else {
        return false;
    }
}



module.exports.setEnvironment = function (new_environment) {
    environment = new_environment;
};

// Get the current config. Optionally for a different environment than currently set
module.exports.get = function (specific_environment) {
    specific_environment = specific_environment || environment;
    
    return loaded_config[specific_environment] || {};
};

module.exports.loadConfig = loadConfig;

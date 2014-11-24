module.exports = function () {
    var config = require('../configuration.js');
    var conf_switch = process.argv.indexOf('-c');
    if (conf_switch !== -1) {
        if (process.argv[conf_switch + 1]) {
            return config.loadConfig(process.argv[conf_switch + 1]);
        }
    }

    return config.loadConfig();
}

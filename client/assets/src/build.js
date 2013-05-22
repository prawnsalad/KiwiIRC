var fs        = require('fs'),
    uglyfyJS  = require('uglify-js'),
    _         = require('lodash'),
    config    = require('./../../../server/configuration.js');

var FILE_ENCODING = 'utf-8',
    EOL = '\n';


function concat(src) {
    var file_list = src;
    var out = file_list.map(function(file_path){
        return fs.readFileSync(file_path, FILE_ENCODING) + '\n\n';
    });

    return out.join(EOL);
}



config.loadConfig();





/**
 * Build the _kiwi.js files
 */

var src = concat([
    __dirname + '/app.js',
    __dirname + '/models/application.js',
    __dirname + '/models/gateway.js',
    __dirname + '/models/network.js',
    __dirname + '/models/member.js',
    __dirname + '/models/memberlist.js',
    __dirname + '/models/newconnection.js',
    __dirname + '/models/panel.js',
    __dirname + '/models/panellist.js',
    __dirname + '/models/networkpanellist.js',
    __dirname + '/models/query.js',
    __dirname + '/models/channel.js',
    __dirname + '/models/server.js',
    __dirname + '/models/applet.js',
    __dirname + '/models/pluginmanager.js',
    __dirname + '/models/datastore.js',

    __dirname + '/applets/settings.js',
    __dirname + '/applets/chanlist.js',
    __dirname + '/applets/scripteditor.js',

    __dirname + '/utils.js',
    __dirname + '/views/view.js'
]);


src = '(function (global, undefined) {\n\n' + src + '\n\n})(window);';


fs.writeFileSync(__dirname + '/../kiwi.js', src, FILE_ENCODING);


src = uglyfyJS.parser.parse(src);
src = uglyfyJS.uglify.ast_mangle(src);
src = uglyfyJS.uglify.ast_squeeze(src);
fs.writeFileSync(__dirname + '/../kiwi.min.js', uglyfyJS.uglify.gen_code(src), FILE_ENCODING);




console.log('kiwi.js and kiwi.min.js built');










/**
 * Build the index.html file
 */

var index_src = fs.readFileSync(__dirname + '/index.html.tmpl', FILE_ENCODING);
var vars = {
    base_path: config.get().http_base_path || '/kiwi',
    cache_buster: Math.ceil(Math.random() * 9000).toString(),
    server_settings: {},
    client_plugins: []
};

// Any restricted server mode set?
if (config.get().restrict_server) {
    vars.server_settings = {
        connection: {
            server: config.get().restrict_server,
            port: config.get().restrict_server_port || 6667,
            ssl: config.get().restrict_server_ssl,
            channel: config.get().restrict_server_channel,
            nick: config.get().restrict_server_nick,
            allow_change: false
        }
    };
}

// Any client default settings?
if (config.get().client) {
    vars.server_settings.client = config.get().client;
}

// Any client plugins?
if (config.get().client_plugins && config.get().client_plugins.length > 0) {
    vars.client_plugins = config.get().client_plugins;
}

_.each(vars, function(value, key) {
    if (typeof value === 'object') value = JSON.stringify(value);
    index_src = index_src.replace(new RegExp('<%' + key + '%>', 'g'), value);
});

fs.writeFileSync(__dirname + '/../../index.html', index_src, FILE_ENCODING);


console.log('index.html built');
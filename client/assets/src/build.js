var fs        = require('fs'),
    uglifyJS  = require('uglify-js'),
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


var source_files = [
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

    __dirname + '/helpers/utils.js',

    __dirname + '/views/panel.js',
    __dirname + '/views/channel.js',
    __dirname + '/views/applet.js',
    __dirname + '/views/application.js',
    __dirname + '/views/apptoolbar.js',
    __dirname + '/views/controlbox.js',
    __dirname + '/views/mediamessage.js',
    __dirname + '/views/member.js',
    __dirname + '/views/memberlist.js',
    __dirname + '/views/menubox.js',
    __dirname + '/views/networktabs.js',
    __dirname + '/views/nickchangebox.js',
    __dirname + '/views/resizehandler.js',
    __dirname + '/views/serverselect.js',
    __dirname + '/views/statusmessage.js',
    __dirname + '/views/tabs.js',
    __dirname + '/views/topicbar.js',
    __dirname + '/views/userbox.js'
];


/**
 * Build the kiwi.js/kiwi.min.js files
 */
var src = concat(source_files);
src = '(function (global, undefined) {\n\n' + src + '\n\n})(window);';


fs.writeFileSync(__dirname + '/../kiwi.js', src, FILE_ENCODING);

// Uglify can take take an array of filenames to produce minified code
// but it's not wraped in an IIFE and produces a slightly larger file
//src = uglifyJS.minify(source_files);

var ast = uglifyJS.parse(src, {filename: 'kiwi.js'});
ast.figure_out_scope();
ast = ast.transform(uglifyJS.Compressor({warnings: false}));
ast.figure_out_scope();
ast.compute_char_frequency();
ast.mangle_names();
src = ast.print_to_string();

fs.writeFileSync(__dirname + '/../kiwi.min.js', src, FILE_ENCODING);




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
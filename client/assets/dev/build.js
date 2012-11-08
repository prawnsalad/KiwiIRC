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
    __dirname + '/model_application.js',
    __dirname + '/model_gateway.js',
    __dirname + '/model_member.js',
    __dirname + '/model_memberlist.js',
    __dirname + '/model_panel.js',
    __dirname + '/model_panellist.js',
    __dirname + '/model_query.js',
    __dirname + '/model_channel.js',
    __dirname + '/model_server.js',
    __dirname + '/model_applet.js',
    __dirname + '/model_pluginmanager.js',
    __dirname + '/model_datastore.js',

    __dirname + '/applet_settings.js',
    __dirname + '/applet_nickserv.js',
    __dirname + '/applet_chanlist.js',

    __dirname + '/utils.js',
    __dirname + '/view.js'
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
    base_path: config.get().http_base_path,
    cache_buster: Math.ceil(Math.random() * 9000).toString()
};

_.each(vars, function(value, key) {
    index_src = index_src.replace(new RegExp('<%' + key + '%>', 'g'), value);
});

fs.writeFileSync(__dirname + '/../../index.html', index_src, FILE_ENCODING);


console.log('index.html built');
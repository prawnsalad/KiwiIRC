var fs = require('fs');
var uglyfyJS = require('uglify-js');

var FILE_ENCODING = 'utf-8',
    EOL = '\n';


function concat(src) {
    var file_list = src;
    var out = file_list.map(function(file_path){
        return fs.readFileSync(file_path, FILE_ENCODING) + '\n\n';
    });

    return out.join(EOL);
}

var src = concat([
    __dirname + '/app.js',
    __dirname + '/model_application.js',
    __dirname + '/model_gateway.js',
    __dirname + '/model_member.js',
    __dirname + '/model_memberlist.js',
    __dirname + '/model_panel.js',
    __dirname + '/model_panellist.js',
    __dirname + '/model_channel.js',
    __dirname + '/model_server.js',

    __dirname + '/utils.js',
    __dirname + '/view.js'
]);


src = '(function (window) {\n\n' + src + '\n\n})(window);';


fs.writeFileSync(__dirname + '/../kiwi.js', src, FILE_ENCODING);


src = uglyfyJS.parser.parse(src);
src = uglyfyJS.uglify.ast_mangle(src);
src = uglyfyJS.uglify.ast_squeeze(src);
fs.writeFileSync(__dirname + '/../kiwi.min.js', uglyfyJS.uglify.gen_code(src), FILE_ENCODING);




console.log(' kiwi.js and kiwi.min.js built');
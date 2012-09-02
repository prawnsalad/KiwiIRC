var fs = require('fs');
var uglyfyJS = require('uglify-js');

var FILE_ENCODING = 'utf-8',
    EOL = '\n';


function concat(opts) {
    var file_list = opts.src;
    var dist_path = opts.dest;
    var out = file_list.map(function(file_path){
        return fs.readFileSync(file_path, FILE_ENCODING);
    });

    fs.writeFileSync(dist_path, out.join(EOL), FILE_ENCODING);
}

concat({
    src : [
        'utils.js',
        'model.js',
        'model_application.js',
        'model_gateway.js',
        'view.js'
    ],
    dest : '../kiwi.js'
});


ast = uglyfyJS.parser.parse(fs.readFileSync('../kiwi.js', FILE_ENCODING));
ast = uglyfyJS.uglify.ast_mangle(ast);
ast = uglyfyJS.uglify.ast_squeeze(ast);
fs.writeFileSync('../kiwi.min.js', uglyfyJS.uglify.gen_code(ast), FILE_ENCODING);




console.log(' kiwi.js and kiwi.min.js built');
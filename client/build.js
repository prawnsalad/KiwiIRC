var fs           = require('fs'),
    uglifyJS     = require('uglify-js'),
    _            = require('lodash'),
    po2json      = require('po2json'),
    config       = require('../server/configuration.js'),
    package_json = require('../package.json');

var FILE_ENCODING = 'utf-8',
    EOL = '\n';


function concat(file_list, callback) {
    var num_files = file_list.length,
        files = [],
        loaded = 0,
        error = false;

    file_list.forEach(function (file_path, idx) {
        if (error) {
            return;
        }
        fs.readFile(file_path, { encoding: FILE_ENCODING }, function (err, data) {
            if (error) {
                return;
            } else if (err) {
                error = true;
                return callback(err);
            }
            files[idx] = data + '\n\n';
            if (++loaded === num_files) {
                callback(null, files.join(EOL));
            }
        });
    });
}



config.loadConfig();


var source_files = [
    __dirname + '/src/app.js',
    __dirname + '/src/models/application.js',
    __dirname + '/src/models/gateway.js',
    __dirname + '/src/models/network.js',
    __dirname + '/src/models/member.js',
    __dirname + '/src/models/memberlist.js',
    __dirname + '/src/models/session.js',
    __dirname + '/src/models/newconnection.js',
    __dirname + '/src/models/panel.js',
    __dirname + '/src/models/panellist.js',
    __dirname + '/src/models/networkpanellist.js',
    __dirname + '/src/models/channel.js',
    __dirname + '/src/models/query.js',
    __dirname + '/src/models/server.js',
    __dirname + '/src/models/applet.js',
    __dirname + '/src/models/pluginmanager.js',
    __dirname + '/src/models/datastore.js',
    __dirname + '/src/models/channelinfo.js',

    __dirname + '/src/views/panel.js',
    __dirname + '/src/views/channel.js',
    __dirname + '/src/views/applet.js',
    __dirname + '/src/views/application.js',
    __dirname + '/src/views/apptoolbar.js',
    __dirname + '/src/views/controlbox.js',
    __dirname + '/src/views/favicon.js',
    __dirname + '/src/views/mediamessage.js',
    __dirname + '/src/views/member.js',
    __dirname + '/src/views/memberlist.js',
    __dirname + '/src/views/menubox.js',
    __dirname + '/src/views/networktabs.js',
    __dirname + '/src/views/nickchangebox.js',
    __dirname + '/src/views/resizehandler.js',
    __dirname + '/src/views/serverselect.js',
    __dirname + '/src/views/statusmessage.js',
    __dirname + '/src/views/tabs.js',
    __dirname + '/src/views/topicbar.js',
    __dirname + '/src/views/userbox.js',
    __dirname + '/src/views/channeltools.js',
    __dirname + '/src/views/channelinfo.js',
    __dirname + '/src/views/rightbar.js',
    __dirname + '/src/views/notification.js',

    __dirname + '/src/misc/clientuicommands.js',

    __dirname + '/src/applets/settings.js',
    __dirname + '/src/applets/chanlist.js',
    __dirname + '/src/applets/scripteditor.js',
    __dirname + '/src/applets/startup.js'
];


var helpers_path = __dirname + '/src/helpers/';
var helpers_sources = fs.readdirSync(helpers_path)
    .map(function(file){
        return helpers_path + file;
    });

source_files = source_files.concat(helpers_sources);


/**
 * Build the kiwi.js/kiwi.min.js files
 */
concat(source_files, function (err, src) {
    if (!err) {
        src = '(function (global, undefined) {\n\n' + src + '\n\n})(window);';

        fs.writeFile(__dirname + '/assets/kiwi.js', src, { encoding: FILE_ENCODING }, function (err) {
            if (!err) {
                console.log('Built kiwi.js');
            } else {
                console.error('Error building kiwi.js:', err);
            }
        });

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

        fs.writeFile(__dirname + '/assets/kiwi.min.js', src, { encoding: FILE_ENCODING }, function (err) {
            if (!err) {
                console.log('Built kiwi.min.js');
            } else {
                console.error('Error building kiwi.min.js:', err);
            }
        });
    } else {
        console.error('Error building kiwi.js and kiwi.min.js:', err);
    }
});






/**
 * Build the engineio client + tools libs
 */
concat([__dirname + '/assets/libs/engine.io.js', __dirname + '/assets/libs/engine.io.tools.js'], function (err, src) {
    if (!err) {
        fs.writeFile(__dirname + '/assets/libs/engine.io.bundle.js', src, { encoding: FILE_ENCODING }, function (err) {
            if (!err) {
                console.log('Built engine.io.bundle.js');
            } else {
                console.error('Error building engine.io.bundle.js:', err);
            }
        });

        var ast = uglifyJS.parse(src, {filename: 'engine.io.bundle.js'});
        ast.figure_out_scope();
        ast = ast.transform(uglifyJS.Compressor({warnings: false}));
        ast.figure_out_scope();
        ast.compute_char_frequency();
        ast.mangle_names();
        src = ast.print_to_string();

        fs.writeFile(__dirname + '/assets/libs/engine.io.bundle.min.js', src, { encoding: FILE_ENCODING }, function (err) {
            if (!err) {
                console.log('Built engine.io.bundle.min.js');
            } else {
                console.error('Error building engine.io.bundle.min.js:', err);
            }
        });
    } else {
        console.error('Error building engine.io.bundle.js and engine.io.bundle.min.js:', err);
    }
});






/**
*   Convert translations from .po to .json
*/
if (!fs.existsSync(__dirname + '/assets/locales')) {
    fs.mkdirSync(__dirname + '/assets/locales');
}
fs.readdir(__dirname + '/src/translations', function (err, translation_files) {
    if (!err) {
        translation_files.forEach(function (file) {
            var locale = file.slice(0, -3);

            if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                po2json.parseFile(__dirname + '/src/translations/' + file, {format: 'jed', domain: locale}, function (err, json) {
                    if (!err) {

                        fs.writeFile(__dirname + '/assets/locales/' + locale + '.json', JSON.stringify(json), function (err) {
                            if (!err) {
                                console.log('Built translation file %s.json', locale);
                            } else {
                                console.error('Error building translation file %s.json:', locale, err);
                            }
                        });
                    } else {
                        console.error('Error building translation file %s.json: ', locale, err);
                    }
                });
            }
        });
    } else {
        console.error('Error building translation files:', err);
    }
});






/**
 * Build the index.html file
 */
var build_time = new Date().getTime();
var base_path = config.get().http_base_path || '';

// Trim off any trailing slashes
if (base_path.substr(base_path.length - 1) === '/') {
    base_path = base_path.substr(0, base_path.length - 1);
}

var index_src = fs.readFileSync(__dirname + '/src/index.html.tmpl', FILE_ENCODING)
    .replace(new RegExp('<%base_path%>', 'g'), base_path)
    .replace(new RegExp('<%build_version%>', 'g'), package_json.version)
    .replace(new RegExp('<%build_time%>', 'g'), build_time);

fs.writeFile(__dirname + '/index.html', index_src, { encoding: FILE_ENCODING }, function (err) {
    if (!err) {
        console.log('Built index.html');
    } else {
        console.error('Error building index.html');
    }
});

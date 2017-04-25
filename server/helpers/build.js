var fs           = require('fs'),
    uglifyJS     = require('uglify-js'),
    po2json      = require('po2json'),
    package_json = require('../../package.json');

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



if (!require('./configloader.js')()) {
    console.error('Couldn\'t find a valid config.js file (Did you copy the config.example.js file yet?)');
    process.exit(1);
}

var source_files = [
    global.config.public_http + '/src/app.js',
    global.config.public_http + '/src/models/application.js',
    global.config.public_http + '/src/models/gateway.js',
    global.config.public_http + '/src/models/network.js',
    global.config.public_http + '/src/models/member.js',
    global.config.public_http + '/src/models/memberlist.js',
    global.config.public_http + '/src/models/newconnection.js',
    global.config.public_http + '/src/models/panel.js',
    global.config.public_http + '/src/models/panellist.js',
    global.config.public_http + '/src/models/networkpanellist.js',
    global.config.public_http + '/src/models/channel.js',
    global.config.public_http + '/src/models/query.js',
    global.config.public_http + '/src/models/server.js',
    global.config.public_http + '/src/models/applet.js',
    global.config.public_http + '/src/models/pluginmanager.js',
    global.config.public_http + '/src/models/datastore.js',
    global.config.public_http + '/src/models/channelinfo.js',

    global.config.public_http + '/src/views/panel.js',
    global.config.public_http + '/src/views/channel.js',
    global.config.public_http + '/src/views/applet.js',
    global.config.public_http + '/src/views/application.js',
    global.config.public_http + '/src/views/apptoolbar.js',
    global.config.public_http + '/src/views/controlbox.js',
    global.config.public_http + '/src/views/favicon.js',
    global.config.public_http + '/src/views/mediamessage.js',
    global.config.public_http + '/src/views/member.js',
    global.config.public_http + '/src/views/memberlist.js',
    global.config.public_http + '/src/views/menubox.js',
    global.config.public_http + '/src/views/networktabs.js',
    global.config.public_http + '/src/views/nickchangebox.js',
    global.config.public_http + '/src/views/resizehandler.js',
    global.config.public_http + '/src/views/serverselect.js',
    global.config.public_http + '/src/views/statusmessage.js',
    global.config.public_http + '/src/views/tabs.js',
    global.config.public_http + '/src/views/topicbar.js',
    global.config.public_http + '/src/views/userbox.js',
    global.config.public_http + '/src/views/channeltools.js',
    global.config.public_http + '/src/views/channelinfo.js',
    global.config.public_http + '/src/views/rightbar.js',
    global.config.public_http + '/src/views/notification.js',

    global.config.public_http + '/src/misc/clientuicommands.js',

    global.config.public_http + '/src/applets/settings.js',
    global.config.public_http + '/src/applets/chanlist.js',
    global.config.public_http + '/src/applets/scripteditor.js',
    global.config.public_http + '/src/applets/startup.js'
];


var helpers_path = global.config.public_http + '/src/helpers/';
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

        fs.writeFile(global.config.public_http + '/assets/kiwi.js', src, { encoding: FILE_ENCODING }, function (err) {
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

        fs.writeFile(global.config.public_http + '/assets/kiwi.min.js', src, { encoding: FILE_ENCODING }, function (err) {
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
concat([global.config.public_http + '/assets/libs/engine.io.js', global.config.public_http + '/assets/libs/engine.io.tools.js'], function (err, src) {
    if (!err) {
        fs.writeFile(global.config.public_http + '/assets/libs/engine.io.bundle.js', src, { encoding: FILE_ENCODING }, function (err) {
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

        fs.writeFile(global.config.public_http + '/assets/libs/engine.io.bundle.min.js', src, { encoding: FILE_ENCODING }, function (err) {
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
if (!fs.existsSync(global.config.public_http + '/assets/locales')) {
    fs.mkdirSync(global.config.public_http + '/assets/locales');
}
fs.readdir(global.config.public_http + '/src/translations', function (err, translation_files) {
    if (!err) {
        translation_files.forEach(function (file) {
            var locale = file.slice(0, -3);

            if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                po2json.parseFile(global.config.public_http + '/src/translations/' + file, {format: 'jed', domain: locale}, function (err, json) {
                    if (!err) {

                        fs.writeFile(global.config.public_http + '/assets/locales/' + locale + '.json', JSON.stringify(json), function (err) {
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
var base_path = global.config.http_base_path || '';

// Trim off any trailing slashes
if (base_path.substr(base_path.length - 1) === '/') {
    base_path = base_path.substr(0, base_path.length - 1);
}

var index_src = fs.readFileSync(global.config.public_http + '/src/index.html.tmpl', FILE_ENCODING)
    .replace(new RegExp('<%base_path%>', 'g'), base_path)
    .replace(new RegExp('<%build_version%>', 'g'), package_json.version)
    .replace(new RegExp('<%build_time%>', 'g'), build_time);

fs.writeFile(global.config.public_http + '/index.html', index_src, { encoding: FILE_ENCODING }, function (err) {
    if (!err) {
        console.log('Built index.html');
    } else {
        console.error('Error building index.html');
    }
});

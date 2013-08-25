var fs        = require('fs'),
    uglifyJS  = require('uglify-js'),
    _         = require('lodash'),
    po2json   = require('po2json'),
    config    = require('./../../../server/configuration.js');

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
    __dirname + '/views/favicon.js',
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
concat(source_files, function (err, src) {
    if (!err) {
        src = '(function (global, undefined) {\n\n' + src + '\n\n})(window);';

        fs.writeFile(__dirname + '/../kiwi.js', src, { encoding: FILE_ENCODING }, function (err) {
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

        fs.writeFile(__dirname + '/../kiwi.min.js', src, { encoding: FILE_ENCODING }, function (err) {
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
*   Convert translations from .po to .json
*/
if (!fs.existsSync(__dirname + '/../locales')) {
    fs.mkdirSync(__dirname + '/../locales');
}
fs.readdir(__dirname + '/translations', function (err, translation_files) {
    if (!err) {
        translation_files.forEach(function (file) {
            var locale = file.slice(0, -3);

            if ((file.slice(-3) === '.po') && (locale !== 'template')) {
                po2json.parse(__dirname + '/translations/' + file, function (err, json) {
                    if (!err) {
                        fs.writeFile(__dirname + '/../locales/' + locale + '.json', JSON.stringify(json), function (err) {
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

var index_src = fs.readFileSync(__dirname + '/index.html.tmpl', FILE_ENCODING)
    .replace(new RegExp('<%base_path%>', 'g'), config.get().http_base_path || '/kiwi');

fs.writeFile(__dirname + '/../../index.html', index_src, { encoding: FILE_ENCODING }, function (err) {
    if (!err) {
        console.log('Built index.html');
    } else {
        console.error('Error building index.html');
    }
});

var fs           = require('fs'),
    path         = require('path');

module.exports = function sourceListing(src_dir) {
    var source_files = [],
        applets = [];

    // Separate applets as they will be loaded at the end.
    dirListing(src_dir, true, function(path) {
        if (!path.match(/\.js$/)) return;

        // TODO: Applets are isolated from the core code base. Should they be
        // renamed  to file.applet.js? Makes detecting them more specific.
        path.indexOf('/src/applets/') >= 0 ?
            applets.push(path) :
            source_files.push(path);
    });

    return source_files.concat(applets);
};





function dirListing(dir, recursive, mapFn) {
    var results = [];
    var list = fs.readdirSync(dir);

    list.forEach(function(file) {
        file = path.join(dir, file);

        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (recursive) results = results.concat(dirListing(file, recursive, mapFn));
        } else {
            if (mapFn) {
                mapFn(file) && results.push(file);
            } else {
                results.push(file);
            }
        }
    });

    return results
}
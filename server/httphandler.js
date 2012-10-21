var url         = require('url'),
    node_static = require ('node-static');



var HttpHandler = function (config) {
    var public_html = config.public_html || 'client/';
    this.file_server = new node_static.Server(public_html);
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // The incoming requests root directory (ie. /kiwiclient/)
    // TODO: check the config for this setting
    var root_path = '/client',
        root_path_regex = root_path.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Any asset request to head into the asset dir
    request.url = request.url.replace(root_path + '/assets/', '/assets/');

    // Any requests for /client to load the index file
    if (request.url.match(new RegExp('^' + root_path_regex, 'i'))) {
        request.url = '/';
    }


    this.file_server.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};
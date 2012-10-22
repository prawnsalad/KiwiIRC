var url         = require('url'),
    node_static = require ('node-static'),
    config      = require('./configuration.js');



var HttpHandler = function (config) {
    var public_html = config.public_html || 'client/';
    this.file_server = new node_static.Server(public_html);
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // The incoming requests base path (ie. /kiwiclient)
    var base_path = config.get().http_base_path || '/kiwi',
        base_path_regex;

    // Trim of any trailing slashes
    if (base_path.substr(base_path.length - 1) === '/') {
        base_path = base_path.substr(0, base_path.length - 1);
    }
    
    // Build the regex to match the base_path
    base_path_regex = base_path.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

    // Any asset request to head into the asset dir
    request.url = request.url.replace(base_path + '/assets/', '/assets/');

    // Any requests for /client to load the index file
    if (request.url.match(new RegExp('^' + base_path_regex + '([/$]|$)', 'i'))) {
        request.url = '/';
    }


    this.file_server.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};
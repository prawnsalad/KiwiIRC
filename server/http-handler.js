var url         = require('url'),
    node_static = require ('node-static');



var HttpHandler = function (config) {
    var public_html = config.public_html || 'client/';
    this.file_server = new node_static.Server(public_html);
};

module.exports.HttpHandler = HttpHandler;



HttpHandler.prototype.serve = function (request, response) {
    // Any requests for /client to load the index file
    if (request.url.match(/^\/client/)) {
        request.url = '/';
    }

    this.file_server.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};
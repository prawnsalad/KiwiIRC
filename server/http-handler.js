var url         = require('url'),
    node_static = require ('node-static');

var HTTPHandler = function (config) {
    this.static_file_server = new StaticFileServer(config.public_html);
};

module.exports.HTTPHandler = HTTPHandler;

var StaticFileServer = function (public_html) {
    public_html = public_html || 'client_backbone/';
    this.fileServer = new node_static.Server(public_html);
};

StaticFileServer.prototype.serve = function (request, response) {
    // Any requests for /client to load the index file
    if (request.url.match(/^\/client/)) {
        request.url = '/';
    }

    this.fileServer.serve(request, response, function (err) {
        if (err) {
            response.writeHead(err.status, err.headers);
            response.end();
        }
    });
};

HTTPHandler.prototype.handler = function (request, response) {
    var uri, subs;
    
    uri = url.parse(request.url, true);
    subs = uri.pathname.substr(0, 4);
    
    if (uri.pathname.substr(0, 10) === '/socket.io') {
        return;
    } else {
        this.static_file_server.serve(request, response);
    }
};
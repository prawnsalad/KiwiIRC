var fs          = require('fs'),
    crypto      = require('crypto');
    url         = require('url'),
    _           = require('underscore'),
    uglify      = require('uglify-js'),
    jade        = require('jade'),
    node_static = require ('node-static');

var HTTPHandler = function (config) {
    var site = config.site;
    this.config = config;
    var files;
    files = fs.readdirSync('client');
    if ((typeof site !== 'undefined') && (typeof site === 'string') && (_.include(files, site))) {
        this.site = site;
        this.static_file_server = new StaticFileServer(site);
    }
    else {
        this.site = 'default';
        this.static_file_server = null;
    }
    
};

module.exports.HTTPHandler = HTTPHandler;

var default_static_file_server = new node_static.Server('client_backbone/');

var StaticFileServer = function (site) {
    this.fileServer = new node_static.Server('client_backbone/');
};

StaticFileServer.prototype.serve = function (request, response) {
    this.fileServer.serve(request, response, function (err) {
        if (err) {
            default_static_file_server.serve(request, response);
        }
    });
};

var serve_static_file = function (request, response) {
    if (this.static_file_server !== null) {
        this.static_file_server.serve(request, response);
    } else {
        default_static_file_server.serve(request, response);
    }
};

HTTPHandler.prototype.handler = function (request, response) {
    var file_list, default_file_list, hash, uri, site, subs, self = this;
    
    uri = url.parse(request.url, true);
    subs = uri.pathname.substr(0, 4);
    
    if (uri.pathname.substr(0, 10) === '/socket.io') {
        return;
    } else {
        serve_static_file.call(this, request, response);
    }
};

var cache = Object.create(null);

var set_cache = function (site, file, data) {
    if (!cache[site]) {
        cache[site] = Object.create(null);
    }
    var hash = crypto.createHash('md5').update(data).digest('base64');
    cache[site][file] = {'data': data, 'hash': hash};
    return hash;
};

var is_cached = function (site, file) {
    if ((cache[site]) && (cache[site][file])) {
        return cache[site][file].hash;
    } else {
        return false;
    }
};

var get_cache = function (site, file) {
    return cache[site][file].data;
};

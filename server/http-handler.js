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
    
    site = 'default';
    uri = url.parse(request.url, true);
    subs = uri.pathname.substr(0, 4);
    
    if (uri.pathname === '/all.js') {
        hash = is_cached(site,'all.js');
        if (!hash) {
            file_list = [];
			default_file_list = [];
            console.log('a');
            fs.readFile('client_backbone/manifest.json', 'utf-8', function (err, manifest) {
                console.log('b');
                var js = '';
                manifest = JSON.parse(manifest);
                _.each(manifest.js, function (file) {
                    console.log(file)
                    js += fs.readFileSync('client_backbone/js/' + file, 'utf-8') + '\r\n';
                });
                
                // TODO: Replace false with check for debug flag
                if (/* debug === */ false) {
                    js = uglify.uglify.gen_code(uglify.uglify.ast_squeeze(uglify.uglify.ast_mangle(uglify.parser.parse(js))));
                }
                
                hash = set_cache(site, 'all.js', js);
                if (request.headers['if-none-match'] === hash) {
                    response.statusCode = 304;
                } else {
                    response.setHeader('Content-type', 'application/javascript');
                    response.setHeader('ETag', hash);
                    response.write(js);
                }
                response.end();
            });
        } else {
            if (request.headers['if-none-match'] === hash) {
                response.statusCode = 304;
            } else {
                response.setHeader('Content-type', 'application/javascript');
                response.setHeader('ETag', hash);
                response.write(get_cache(site, 'all.js'));
            }
            response.end();
        }
    } else if (uri.pathname === '/') {
        var jadefile = '';
        
        hash = is_cached(site, '/');
        
        if (!hash) {
            try {
                fs.readFile('client_backbone/index.jade', 'utf-8', function (err, str) {
                    if (err) {
                        console.log(err + '');
                        response.end();
                    } else {
                        jadefile = str;
                    }
                    hash = set_cache('default', '/', jade.compile(jadefile, {pretty: true})());
                    if (response.statusCode !== 500) {
                        if (request.headers['if-none-match'] === hash) {
                            response.statusCode = 304;
                        } else {
                            response.setHeader('Content-type', 'text/html; charset=utf-8');
                            response.setHeader('ETag', hash);
                            response.write(get_cache(site, '/'));
                        }
                    }
                    response.end();
                });
                
            } catch (e) {
                console.log(e);
                response.statusCode = 500;
                response.end();
            }
        } else {
            if (request.headers['if-none-match'] === hash) {
                response.statusCode = 304;
            } else {
                response.setHeader('Content-type', 'text/html; charset=utf-8');
                response.setHeader('ETag', hash);
                response.write(get_cache(site, '/'));
            }
            response.end();
        }
    } else if ((subs === '/img') || (subs === '/css')) {
        serve_static_file.call(this, request, response);
    } else if (uri.pathname.substr(0, 10) === '/socket.io') {
        return;
    } else {
        response.statusCode = 404;
        response.end();
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

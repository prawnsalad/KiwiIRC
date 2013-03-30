var conf = {};

// Run the Kiwi server under a different user/group
conf.user = "";
conf.group = "";


// Log file location
conf.log = "kiwi.log";



/*
 * Server listen blocks
 */

// Do not edit this line!
conf.servers = [];

// Example server block
conf.servers.push({
    port:   7778,
    address: "0.0.0.0"
});

// Example SSL server block
//conf.servers.push({
//    port:     7777,
//    address: "0.0.0.0",
//
//    ssl:   true,
//    ssl_key: "server.key",
//    ssl_cert: "cert.pem"
//});



// Do we want to enable the built in Identd server?
conf.identd = {
    enabled: false,
    port: 113,
    address: "0.0.0.0"
};






// Where the client files are
conf.public_http = "client/";

// Max connections per connection. 0 to disable
conf.max_client_conns = 5;


/*
 * Client side plugins
 * Array of URLs that will be loaded into the browser when the client first loads up
 * See http://github.com/prawnsalad/KiwiIRC/wiki/Client-plugins
 */
conf.client_plugins = [
    // "http://server.com/kiwi/plugins/myplugin.html"
];



// Enabled CAP extensions (See ENTER URL TO CAP INFO HERE PLS)
conf.cap_options = [];




// Directory to find the server modules
conf.module_dir = "../server_modules/";

// Which modules to load
conf.modules = [];




// WebIRC passwords enabled for this server
conf.webirc_pass = {
    //"irc.network.com":  "configured_webirc_password",
    //"127.0.0.1":        "foobar"
};

// Some IRCDs require the clients IP via the username/ident
conf.ip_as_username = [
	//"irc.network.com",
	//"127.0.0.1"
];

// Whether to verify IRC servers' SSL certificates against built-in well-known certificate authorities
conf.reject_unauthorised_certificates = false;



/*
 * Reverse proxy settings
 * Reverse proxies that have been reported to work can be found at:
 *     http://github.com/prawnsalad/KiwiIRC/wiki/Running-behind-a-proxy
 */

// Whitelisted HTTP proxies in CIDR format
conf.http_proxies = ["127.0.0.1/32"];

// Header that contains the real-ip from the HTTP proxy
conf.http_proxy_ip_header = "x-forwarded-for";

// Base HTTP path to the KIWI IRC client (eg. /kiwi)
conf.http_base_path = "/kiwi";



// Enabled transports for the browser to use
conf.transports = [
    "websocket",
    "flashsocket",
    "htmlfile",
    "xhr-polling",
    "jsonp-polling"
];




// Default quit message
conf.quit_message = "http://www.kiwiirc.com/ - A hand-crafted IRC client";


// Default settings for the client. These may be changed in the browser
conf.client = {
    server: 'irc.kiwiirc.com',
    port:    6697,
    ssl:     true,
    channel: '#kiwiirc',
    nick:    'kiwi_?'
};


// If set, the client may only connect to this 1 IRC server
//conf.restrict_server = "irc.kiwiirc.com";
//conf.restrict_server_port = 6667;
//conf.restrict_server_ssl = false;
//conf.restrict_server_channel = "#kiwiirc";
//conf.restrict_server_password = "";
//conf.restrict_server_nick = "kiwi_";




/*
 * Do not ammend the below lines unless you understand the changes!
 */
module.exports.production = conf;

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

// Network interface for outgoing connections
conf.outgoing_address = {
    IPv4: '0.0.0.0'
    //IPv6: '::'
};


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

// Max connections per server. 0 to disable.
// Setting is ignored if:
//   - There is a WEBIRC password configured for the server,
//   - Kiwi is configured to send the client's ip as a username for the server, or
//   - Kiwi is running in restricted server mode.
conf.max_server_conns = 0;

/*
* Default encoding to be used by the server
* As specified and limited to iconv-lite library support.
*/
conf.default_encoding = 'utf8';


/*
* Default GECOS (real name) for IRC connections
* %n will be replaced with the users nick
*/
//conf.default_gecos = 'Web IRC Client';



/*
 * Client side plugins
 * Array of URLs that will be loaded into the browser when the client first loads up
 * See http://github.com/prawnsalad/KiwiIRC/wiki/Client-plugins
 */
conf.client_plugins = [
    // "http://server.com/kiwi/plugins/myplugin.html"
];




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
 *     https://kiwiirc.com/docs/installing/proxies
 */

// Whitelisted HTTP proxies in CIDR format
conf.http_proxies = ["127.0.0.1/32"];

// Header that contains the real-ip from the HTTP proxy
conf.http_proxy_ip_header = "x-forwarded-for";

// Base HTTP path to the KIWI IRC client (eg. /kiwi)
conf.http_base_path = "/kiwi";


/*
 * SOCKS (version 5) proxy settings
 * This feature is only available on node 0.10.0 and above.
 * Do not enable it if you're running 0.8 or below or Bad Things will happen.
 */
conf.socks_proxy = {};

// Enable proxying outbound connections through a SOCKS proxy
conf.socks_proxy.enabled = false;

// Proxy *all* outbound connections through a SOCKS proxy
conf.socks_proxy.all = false;

// Use SOCKS proxy for these hosts only (if conf.sock_proxy.all === false)
conf.socks_proxy.proxy_hosts = [
    "irc.example.com"
];

// Host and port for the SOCKS proxy
conf.socks_proxy.address = '127.0.0.1';
conf.socks_proxy.port = 1080;

// Username and password for the SOCKS proxy
// Set user to null to disable password authentication
conf.socks_proxy.user = null;
conf.socks_proxy.pass = null;



// Default quit message
conf.quit_message = "http://www.kiwiirc.com/ - A hand-crafted IRC client";


// Default settings for the client. These may be changed in the browser
conf.client = {
    server: 'irc.kiwiirc.com',
    port:    6697,
    ssl:     true,
    channel: '#kiwiirc',
    channel_key: '',
    nick:    'kiwi_?',
    settings: {
        theme: 'relaxed',
        channel_list_style: 'tabs',
        scrollback: 250,
        show_joins_parts: true,
        show_timestamps: false,
        mute_sounds: false,
        show_emoticons: true,
        count_joins_parts: true
    },
    window_title: 'Kiwi IRC'
};


// If set, the client may only connect to this 1 IRC server
//conf.restrict_server = "irc.kiwiirc.com";
//conf.restrict_server_port = 6667;
//conf.restrict_server_ssl = false;
//conf.restrict_server_channel = "#kiwiirc";
//conf.restrict_server_channel_key = "";
//conf.restrict_server_password = "";
//conf.restrict_server_nick = "kiwi_";




/*
 * Do not amend the below lines unless you understand the changes!
 */
module.exports.production = conf;

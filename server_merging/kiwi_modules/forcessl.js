/*
 * forcessl Kiwi module
 * Force clients to use an SSL port by redirecting them
 */

var kiwi = require('../kiwi.js');


exports.onhttp = function (ev, opts) {
	var host, port = null, i;

	if (!ev.ssl) {
	    host = ev.request.headers.host;

	    // Remove the port if one is set
	    if (host.search(/:/) > -1) {
	        host = host.substring(0, host.search(/:/));
	    }

    	for (i in kiwi.config.servers) {
    		if (kiwi.config.servers[i].secure) {
    			port = kiwi.config.servers[i].port;
    			break;
    		}
    	}

	    // If we didn't find an SSL listener, don't redirect
	    if (port == null) {
	    	return ev;
	    }

	    // No need to specify port 443 since it's the standard
	    if (port !== 443) {
	    	host += ':' + port.toString();
	    }
	    
	    ev.response.writeHead(302, {'Location': 'https://' + host + ev.request.url});
	    ev.response.end();

	    return null;
	}

	return ev;
}
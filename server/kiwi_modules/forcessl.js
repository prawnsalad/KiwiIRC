/*
 * forcessl Kiwi module
 * Force clients to use an SSL port by redirecting them
 */

var kiwi = require('../kiwi.js');


exports.onhttp = function (ev) {
	var host, port = null, i;

	// TODO: request.socket.pair seems to only be set in a SSL req, is this
	// the best way to check for this?
	if (typeof ev.request.socket.pair === 'undefined') {
	    host = ev.request.headers.host;

	    // Remove the port if one is set
	    if (host.search(/:/) > -1) {
	        host = host.substring(0, host.search(/:/));
	    }

    	for (i in kiwi.config.ports) {
    		if (kiwi.config.ports[i].secure) {
    			port = kiwi.config.ports[i].number;
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

	    console.log('https://' + host + ev.request.url);
	    ev.response.writeHead(302, {'Location': 'https://' + host + ev.request.url});
	    ev.response.end();

	    return null;
	}

	return ev;
}
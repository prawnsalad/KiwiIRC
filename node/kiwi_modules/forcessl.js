/*
 * forcessl Kiwi module
 * Force clients to use an SSL port by redirecting them
 */

var kiwi = require('../kiwi.js');


exports.onhttp = function (ev) {
	// TODO: request.socket.pair seems to only be set in a SSL req, is this
	// the best way to check for this?
	if (typeof ev.request.socket.pair === 'undefined') {
	    host = ev.request.headers.host;
	    //port = 443;
	    
	    if (host.search(/:/)) {
	        //port = parseInt(host.substring(host.search(/:/) + 1), 10);
	        host = host.substring(0, host.search(/:/));
	    }
	    if (kiwi.config.ports[0].number != 443) {
	    	for (i in kiwi.config.ports) {
	    		if (kiwi.config.ports[i].secure) {
	    			host += ':' + kiwi.config.ports[0].number.toString();
	    			break;
	    		}
	    	}
	    }

	    console.log('https://' + host + ev.request.url);
	    ev.response.writeHead(302, {'Location': 'https://' + host + ev.request.url});
	    ev.response.end();

	    return null;
	}

	return ev;
}
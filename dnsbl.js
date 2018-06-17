/**
 * DNS Blacklist support
 *
 * Check the client against a blacklist before connection to an IRC server
 */

var dns = require('dns'),
    kiwiModules = require('../server/modules');


// The available DNS zones to check against
//var bl_zones = {
    //dronebl: '.dnsbl.dronebl.org'
//};

var bl_zones = [
	
    '.dnsbl.dronebl.org',
	'.tor.dnsbl.sectoor.de',
	'.tor.kewlio.net.uk',
	'.socks.dnsbl.sorbs.net',
	'.dnsbl.dronebl.org',
	'.rbl.efnet.org',
	'.rbl.efnetrbl.org'

];

// The DNS zone we should use
//var current_bl = 'dronebl';

var module = new kiwiModules.Module('DNSBL');

module.on('irc connecting', function (event, event_data) {
    event.wait = true;

    var client_addr = event_data.connection.state.client.websocket.meta.real_address;

    //isBlacklisted(client_addr, function(is_blocked) {
        //if (is_blocked) {
            //var err = new Error('DNSBL blocked (' + client_addr + ')');
            //err.code = 'Blacklisted';

            //event_data.connection.emit('error', err);
            //event.preventDefault();
            //event.callback();

        //} else {
            //event.callback();
        //}
    //});
	
	//lets walk through our array - @ivo
	for(i = 0; i < bl_zones.length; i++) {
	
		var host_lookup = reverseIp(client_addr) + bl_zones[i];
		
		checkBlacklist(bl_zones[i], host_lookup, function(state, ip, blacklist) {
			
			if(state) {
				
				var err = new Error('DNSBL blocked (' + client_addr + ') on (' + blacklist + '');
				err.code = 'Blacklisted';

				event_data.connection.emit('error', err);
				event.preventDefault();
				event.callback();
				
			} else event.callback();
			
		});
		
	}

});

//we will check foreach host with that - @ivo
function checkBlacklist(blacklist, ip, callback) {
	
	dns.resolve4(ip, function(err, domain) {
		
		if (err) {
			
			callback(false, ip, blacklist);
			
		} else {
			
			callback(true, ip, blacklist);
			
		}
		
	});
	
}

// The actual checking against the DNS blacklist
//function isBlacklisted(ip, callback) {
  //  var host_lookup = reverseIp(ip) + bl_zones[current_bl];

    //dns.resolve4(host_lookup, function(err, domain) {
        //if (err) {
            // Not blacklisted
            //callback(false);
        //} else {
            // It is blacklisted
            //callback(true);
        //}
    //});
//}


function reverseIp(ip) {
    return ip.split('.').reverse().join('.');
}

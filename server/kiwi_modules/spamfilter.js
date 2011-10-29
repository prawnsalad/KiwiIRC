/*
 * Example Kiwi module.
 * This is by no means is a production ready module.
 */

var filters;
var compiled_regex;

exports.onload = function(){
	filters = [];
	compiled_regex = new RegExp(filters.join('|'), 'im');
}


exports.onmsg = function(msg){
	if (msg.msg.search(compiled_regex) > -1) {
		return null;
	}

	return msg;
}
function randomString(string_length) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	return randomstring;
}

String.prototype.trim = function() {
  return this.replace(/^\s+|\s+$/g, "");
};

String.prototype.lpad = function(length, character){
	var padding = "";
	for(var i=0; i<length; i++) padding += character;
	return (padding + this).slice (-length)
};



/*
	PLUGINS
	Each function in each object is looped through and ran. The resulting text
	is expected to be returned.
*/
var plugins={}; 
plugins.privmsg = [
	{
		name: "html_safe",
		onprivmsg: function(inp, tabview){
			return $('<div/>').text(inp).html();
		}
	},
	
	{
		name: "activity",
		onprivmsg: function(inp, tabview){
			if(front.cur_channel.name.toLowerCase() != front.tabviews[tabview.toLowerCase()].name){
				front.tabviews[tabview].activity();
			}
		}
	},
	
	{
		name: "highlight",
		onprivmsg: function(inp, tabview){
			if(inp.toLowerCase().indexOf(gateway.nick.toLowerCase()) > -1){
				if(front.cur_channel.name.toLowerCase() != front.tabviews[tabview.toLowerCase()].name){
					front.tabviews[tabview].highlight();
				}
				if(front.isChannel(front.tabviews[tabview].name))
					inp = '<span style="color:red;">'+inp+'</span>';
			}
			
			if(
				!front.isChannel(front.tabviews[tabview].name) && front.tabviews[tabview].name != "server"
				&& front.cur_channel.name.toLowerCase() != front.tabviews[tabview.toLowerCase()].name
			){
				front.tabviews[tabview].highlight();
			}
			return inp;
		}
	},

	/*
	{
		name: "images",
		onprivmsg: function(text){
			if( !text ) return text;
			//alert("-"+text+"-");
			text = text.replace(/^((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?(\.jpg|\.jpeg|\.gif|\.bmp|\.png)$/gi,function(url){
				var img = '<img src="'+url+'" height="50" width="50" />';
				return '<a target="_blank" rel="nofollow" href="'+ url +'">'+ img +'</a>';
			});
			
			return text;
		}
	},
	
	*/
	
	
	{
		//Following method taken from: http://snipplr.com/view/13533/convert-text-urls-into-links/
		name: "linkify_plain",
		onprivmsg: function(text){
			if( !text ) return text;
			
			text = text.replace(/((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/gi,function(url){
				nice = url;
				if(url.match('^https?:\/\/')){
					//nice = nice.replace(/^https?:\/\//i,'')
				}else{
					url = 'http://'+url;
				}
				
				return '<a target="_blank" rel="nofollow" href="'+ url +'">'+ nice +'</a>';
			});
			
			return text;
		}
	}
];
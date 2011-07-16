var front = {
	revision: 38,
	
	cur_channel: '',
	windows: {},
	tabviews: {},
	boxes: {},
	
	buffer: [],
	buffer_pos: 0,
	
	init: function () {	
		gateway.nick = 'kiwi_' + Math.ceil(100 * Math.random()) + Math.ceil(100 * Math.random());
		gateway.session_id = null;
		
		$(gateway).bind("onmsg", front.onMsg);
		$(gateway).bind("onnotice", front.onNotice);
		$(gateway).bind("onaction", front.onAction);
		$(gateway).bind("onmotd", front.onMOTD);
		$(gateway).bind("onoptions", front.onOptions);
		$(gateway).bind("onconnect", front.onConnect);
		$(gateway).bind("onnick", front.onNick);
		$(gateway).bind("onuserlist", front.onUserList);
		$(gateway).bind("onuserlist_end", front.onUserListEnd);
		$(gateway).bind("onjoin", front.onJoin);
		$(gateway).bind("ontopic", front.onTopic);
		$(gateway).bind("onpart", front.onPart);
		$(gateway).bind("onkick", front.onKick);
		$(gateway).bind("onquit", front.onQuit);
		$(gateway).bind("onwhois", front.onWhois);
		$(gateway).bind("onsync", front.onSync);
		$(gateway).bind("onchannel_redirect", front.onChannelRedirect);
		$(gateway).bind("ondebug", front.onDebug);
		
		this.buffer = [];
		
		// Build the about box
		front.boxes.about = new box("about");
		front.boxes.about.content.html('<h2>Kiwi IRC</h2>');
		front.boxes.about.content.append("<p>An alternative to downloading an irc client. Kiwi IRC is the best web app you'll use for the next couple years.</p>");
		front.boxes.about.content.append('<button class="about_close">Close</button>');
		
		var about_info = 'UI adapted for ' + agent;
		if (touchscreen) {
            about_info += ' touchscreen ';
        }
		about_info += 'usage';
		
		front.boxes.about.content.append('<p class="info">' + about_info + '</p>');
		front.boxes.about.content.append('<p class="revisions">Front: ' + front.revision + '<br />Gateway: ' + gateway.revision + '</p>');
		
		//$(window).bind("beforeunload", function(){ gateway.quit(); });
		
		front.registerKeys();
		
		
		$('#kiwi .formconnectwindow').submit(function () {
			var netsel = $('#kiwi .formconnectwindow .network');
			var nick = $('#kiwi .formconnectwindow .nick');
			
			if (nick.val() === '') {
				nick.val('Nick please!');
				nick.focus();
				return false;
			}
			
			var tmp = nick.val().split(' ');
			gateway.nick = tmp[0];
			front.doLayout();
			try {
				front.run('/connect ' + netsel.val());
			} catch (e) {
				alert(e);
			}
			
			$('#kiwi .connectwindow').slideUp();
			return false;
		});

		var supportsOrientationChange = "onorientationchange" in window,
		    orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";
		window.addEventListener(orientationEvent, front.doLayoutSize, false);
		//$('#kiwi').bind("resize", front.doLayoutSize, false);

		front.doLayout();
		//front.windowAdd('server');
		front.tabviewAdd('server');
		
		// Any pre-defined nick?
		if (typeof init_data.nick === "string") {
            $('#kiwi .formconnectwindow .nick').val(init_data.nick);
        }
		
		//gateway.session_id = 'testses';
		
		gateway.start();
		//front.sync();
	},
	
	doLayoutSize: function () {
	    var kiwi = $('#kiwi');
		if (kiwi.width() < 330 && !kiwi.hasClass('small_kiwi')) {
			console.log("switching to small kiwi");
			kiwi.removeClass('large_kiwi');
			kiwi.addClass('small_kiwi');
		} else if (kiwi.width() >= 330 && !kiwi.hasClass('large_kiwi')) {
			kiwi.removeClass('small_kiwi');
			kiwi.addClass('large_kiwi');
		}

		var ct = $('#kiwi .cur_topic');
		var ul = $('#kiwi .userlist');

		var top = parseInt(ct.offset().top) + parseInt(ct.height());
        top = top + parseInt(ct.css('border-top-width').replace('px', ''));
        top = top + parseInt(ct.css('border-bottom-width').replace('px', ''));
        top = top + parseInt(ct.css('padding-top').replace('px', ''));
        top = top + parseInt(ct.css('padding-bottom').replace('px', ''));
        top = top + 1;

		$('#kiwi .messages').css('top', top + "px");
		$('#kiwi .userlist').css('top', top + "px");
	},


	doLayout: function () {
		$('#kiwi .msginput .nick a').text(gateway.nick);
		$('#kiwi_msginput').val(' ');
		$('#kiwi_msginput').focus();
	},
	
	
	joinChannel: function (chan_name) {
		var chans = chan_name.split(','),
            i;
		for (i in chans) {
			chan = chans[i];
			if (front.tabviews[chan.toLowerCase()] === undefined) {
				gateway.join(chan);
				front.tabviewAdd(chan);
			} else {
				front.tabviews[chan.toLowerCase()].show();
			}
		}
	},
	
	
	run: function (msg) {
		if (msg.substring(0, 1) === '/') {
			var parts = msg.split(' ');
			switch (parts[0]) {
			case '/j':
			case '/join':
				front.joinChannel(parts[1]);
				break;
				
			case '/connect':
			case '/server':
				if (parts[1] === undefined) {
					alert('Usage: /connect servername [port]');
					break;
				}
				
				if (parts[2] === undefined) {
                    parts[2] = 6667;
                }
				front.cur_channel.addMsg(null, ' ', '=== Connecting to ' + parts[1] + '...', 'status');
				gateway.connect(parts[1], parts[2], 0);
				break;
				
			case '/part':
				if (typeof parts[1] === "undefined") {
					gateway.raw(msg.substring(1) + ' ' + front.cur_channel.name);
				} else {
					gateway.raw(msg.substring(1));
				}
				break;
				
			case '/names':
				if (typeof parts[1] !== "undefined") {
					gateway.raw(msg.substring(1));
				}
				break;
				
			case '/debug':
				gateway.debug();
				break;
				
			case '/q':
			case '/query':
				if (typeof parts[1] !== "undefined") {
					front.tabviewAdd(parts[1]);
				}
				break;
				
			case '/quote':
				gateway.raw(msg.replace(/^\/quote /i, ''));
				break;
				
			case '/me':
				gateway.action(front.cur_channel.name, msg.substring(4));
				//front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* '+data.nick+' '+data.msg, 'color:green;');
				front.cur_channel.addMsg(null, ' ', '* ' + gateway.nick + ' ' + msg.substring(4), 'action', 'color:#555;');
				break;
			case '/quit':
                gateway.quit(msg.split(" ",2)[1]);
                break;

			default:
				//front.cur_channel.addMsg(null, ' ', '--> Invalid command: '+parts[0].substring(1));
				gateway.raw(msg.substring(1));
			}

		} else {
			//alert('Sending message: '+msg);
			if (msg.trim() === '') {
                return;
            }
			gateway.msg(front.cur_channel.name, msg);
			var d = new Date();
			d = d.getHours() + ":" + d.getMinutes();
			//front.addMsg(d, gateway.nick, msg);
			front.cur_channel.addMsg(null, gateway.nick, msg);
		}
	},
	
	
	onMsg: function (e, data) {
        var destination;
		// Is this message from a user?
		if (data.channel === gateway.nick) {
			destination = data.nick.toLowerCase();
		} else {
			destination = data.channel.toLowerCase();	
		}
		
		if (!front.tabviewExists(destination)) {
            front.tabviewAdd(destination);
        }
		front.tabviews[destination].addMsg(null, data.nick, data.msg);
	},
	
	onDebug: function (e, data) {
		if (!front.tabviewExists('kiwi_debug')) {
            front.tabviewAdd('kiwi_debug');
        }
		front.tabviews.kiwi_debug.addMsg(null, ' ', data.msg);
	},
	
	onAction: function (e, data) {
        var destination;
		// Is this message from a user?
		if (data.channel === gateway.nick) {
			destination = data.nick;
		} else {
			destination = data.channel;	
		}
		
		if (!front.tabviewExists(destination)) {
            front.tabviewAdd(destination);
        }
		front.tabviews[destination.toLowerCase()].addMsg(null, ' ', '* ' + data.nick + ' ' + data.msg, 'action', 'color:#555;');
	},
	
	onTopic: function (e, data) {
		if (front.tabviewExists(data.channel)) {
			front.tabviews[data.channel.toLowerCase()].changeTopic(data.topic);			
		}
	},
	
	onNotice: function (e, data) {
		var nick = (data.nick === "") ? "" : '[' + data.nick + ']';
		if (data.channel !== undefined) {
			//alert('notice for '+data.channel);
			if (front.tabviewExists(data.channel)) {
				front.tabviews[data.channel.toLowerCase()].addMsg(null, nick, data.msg, 'notice');
			}
		} else {
			//alert('direct notice');
			front.tabviews.server.addMsg(null, nick, data.msg, 'notice');
		}
	},
	onConnect: function (e, data) {
		if (data.connected) {
			front.tabviews.server.addMsg(null, ' ', '=== Connected OK :)', 'status');
			if (typeof init_data.channel === "string") {
				front.joinChannel(init_data.channel);
			}
		} else {
			front.tabviews.server.addMsg(null, ' ', '=== Failed to connect :(', 'status');
		}
	},
	onOptions: function (e, data) {
		if (typeof gateway.network_name === "string" && gateway.network_name !== "") {
			front.tabviews.server.tab.text(gateway.network_name);
		}
	},
	onMOTD: function (e, data) {
		front.tabviews.server.addMsg(null, data.server, data.msg, 'motd');
	},
	onWhois: function (e, data) {
		front.cur_channel.addMsg(null, data.nick, data.msg, 'whois');
	},
	onUserList: function (e, data) {
		if (front.tabviews[data.channel.toLowerCase()] === undefined) {
            return;
		}
		var ul = front.tabviews[data.channel.toLowerCase()].userlist;
		
		if (!document.userlist_updating) {
			document.userlist_updating = true;
			ul.empty();
		}
		
		$.each(data.users, function (i, item) {
			var nick = i; //i.match(/^.+!/g);
			var mode = item;
			$('<li><a class="nick" onclick="front.userClick(this);">' + mode + nick + '</a></li>').appendTo(ul);
		});
		
		front.tabviews[data.channel.toLowerCase()].userlistSort();
	},
	onUserListEnd: function (e, data) {
		document.userlist_updating = false;
	},
	
	onJoin: function (e, data) {
		if (!front.tabviewExists(data.channel)) {
			front.tabviewAdd(data.channel.toLowerCase());
		}
		
		if (data.nick === gateway.nick) {
            return; // Not needed as it's already in nicklist
        }
		front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '--> ' + data.nick + ' has joined', 'action', 'color:#009900;');
		$('<li><a class="nick" onclick="front.userClick(this);">' + data.nick + '</a></li>').appendTo(front.tabviews[data.channel.toLowerCase()].userlist);
		front.tabviews[data.channel.toLowerCase()].userlistSort();
	},
	onPart: function (e, data) {
		if (front.tabviewExists(data.channel)) {
			// If this is us, close the tabview
			if (data.nick === gateway.nick) {
				front.tabviews[data.channel.toLowerCase()].close();
				front.tabviews.server.show();
				return;
			}
			
			front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.nick + ' has left (' + data.message + ')', 'action', 'color:#990000;');
			front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
				if ($(this).text() === data.nick) {
					$(this).remove();
				}
			});
		}
	},
	onKick: function (e, data) {
		if (front.tabviewExists(data.channel)) {
			// If this is us, close the tabvi ew
			if (data.kicked === gateway.nick) {
				front.tabviews[data.channel.toLowerCase()].close();
				return;
			}
			
			front.tabviews[data.channel.toLowerCase()].addMsg(null, ' ', '<-- ' + data.kicked + ' kicked by ' + data.nick + '(' + data.message + ')', 'action', 'color:#990000;');
			front.tabviews[data.channel.toLowerCase()].userlist.children().each(function () {
				if ($(this).text() === data.nick) {
					$(this).remove();
				}
			});
		}
	},
	onNick: function (e, data) {
		if (data.nick === gateway.nick) {
			gateway.nick = data.newnick;
			front.doLayout();
		}
		
		$.each(front.tabviews, function (i, item) {
			$.each(front.tabviews, function (i, item) {
				item.changeNick(data.newnick, data.nick);
			});
		});
	},
	onQuit: function (e, data) {
		$.each(front.tabviews, function (i, item) {
			$.each(front.tabviews, function (i, item) {
				item.userlist.children().each(function () {
					if ($(this).text() === data.nick) {
						$(this).remove();
						item.addMsg(null, ' ', '<-- ' + data.nick + ' has quit (' + data.message + ')', 'action', 'color:#990000;');
					}
				});
			});
		});
	},
	onChannelRedirect: function (e, data) {
		front.tabviews[data.from.toLowerCase()].close();
		front.tabviewAdd(data.to.toLowerCase());
		front.tabviews[data.to.toLowerCase()].addMsg(null, ' ', '=== Redirected from ' + data.from, 'action');
	},
	
	registerKeys: function () {
		$('#kiwi_msginput').bind('keydown', function (e) {
		//$('input').keypress(function(e){
			switch (e.which) {
			case 27:			// escape					
				return false;
			case 13:			// return
				var msg = $('#kiwi_msginput').val();
				msg = msg.trim();
				
				front.buffer.push(msg);
				front.buffer_pos = front.buffer.length;
				
				front.run(msg);
				$('#kiwi_msginput').val('');
				
				break;
				
			case 38:			// up
				if (front.buffer_pos > 0) {
					front.buffer_pos--;
					$('#kiwi_msginput').val(front.buffer[front.buffer_pos]);
				}
				break;
			case 40:			// down
				if (front.buffer_pos < front.buffer.length) {
					front.buffer_pos++;
					$('#kiwi_msginput').val(front.buffer[front.buffer_pos]);
				}
				break;
				
			case 9:				// tab
				// Get possible autocompletions
				var data = [];
				front.cur_channel.userlist.children().each(function () {
					nick = front.nickStripPrefix($('a.nick', this).text());
					data.push(nick);
				});
				
				// Do the autocomplete
				if (this.value.length === this.selectionStart && this.value.length === this.selectionEnd) {
					var candidates = [];
					
					var word_pos = this.value.lastIndexOf(' ');
					var word = "";
					if (word_pos === -1) {
						word = this.value;
					} else {
						word = this.value.substr(word_pos);
					}
					word = word.trim();
					
					// filter data to find only strings that start with existing value
					for (i = 0; i < data.length; i++) {
						if (data[i].indexOf(word) === 0 && data[i].length > word.length) {
							candidates.push(data[i]);
                        }
					}
					
					if (candidates.length > 0) {
						// some candidates for autocompletion are found
						this.value = this.value.substring(0, word_pos) + ' ' + candidates[0] + ': ';
						this.selectionStart = this.value.length;
					}
				}
				return false;
			}
		});
		
		
		$('#kiwi .control .msginput .nick').click(function () {
			var html = '<div class="newnick box">\
	Your new nick:<br />\
	<form class="form_newnick">\
		<input type="text" class="txtnewnick" /><br />\
		<button class="butnewnick" type="submit">Change</button> <a class="link cancelnewnick">Cancel</a>\
	</form>\
</div>';
			$('#kiwi').append(html);
			$('#kiwi .form_newnick').submit(function () {
				front.run('/NICK ' + $('#kiwi .txtnewnick').val());
				$('#kiwi .newnick').remove();
				return false;
			});
			$('#kiwi .cancelnewnick').click(function () {
				$('#kiwi .newnick').remove();
			});
			
			$('#kiwi .txtnewnick').focus();
			
		});
		
		
		
		
		
		$('#kiwi .plugins .load_plugin_file').click(function () {
			if (typeof front.boxes.plugins !== "undefined") {
                return;
            }
			
			var html = '<div class="list">\
		<h2>Kiwi plugins</h2>\
		<p>\
			<select multiple="multiple" id="plugin_list">\
			</select>\
			<button id="plugins_list_unload">Unload</button>\
		</p>\
	</div>\
	<div class="load">\
		Plugin file URL:<br />\
		<form>\
			<input type="text" class="txtpluginfile" /><br />\
			<button class="butnewnick" type="submit">Load..</button> <a class="link cancelpluginfile">Cancel</a>\
		</form>\
	</div>';
			front.boxes.plugins = new box("plugin_file");
			front.boxes.plugins.content.html(html);
			front.boxes.plugins.box.css('top', -(front.boxes.plugins.height + 40));
			
			// Populate the plugin list..
			var lst = $('#plugin_list');
			lst.find('option').remove();
            var j;
			for (j in plugins.privmsg) {
				var txt = plugins.privmsg[j].name;
				lst.append('<option value="' + txt + '">' + txt + '</option>');
			}
			
			// Event bindings
			$('#kiwi .plugin_file').submit(function () {
				$.getJSON($('.txtpluginfile').val(), function (data) {
					var plg = {};
					plg.name = data.name;
					eval("plg.onprivmsg = " + data.onprivmsg);
					eval("plg.onload = " + data.onload);
					eval("plg.onunload = " + data.onunload);
					plugins.privmsg.push(plg);
					
					if (plg.onload instanceof Function) {
                        plg.onload();
                    }
				});
				return false;
			});
			$('#kiwi .cancelpluginfile').click(function () {
				front.boxes.plugins.destroy();
			});
			
			$('#kiwi #plugins_list_unload').click(function () {
				var selected_plugin = $('#plugin_list').val();
				console.log("removing plugin: "+selected_plugin);
				for (var i in plugins.privmsg) {
					if (plugins.privmsg[i].name === selected_plugin) {
						if (plugins.privmsg[i].onunload instanceof Function)
							plugins.privmsg[i].onunload();
						
						delete plugins.privmsg[i];
					}
				}
			});
			
			$('#kiwi .txtpluginfile').focus();
			
		});
		
		$('#kiwi .plugins .reload_css').click(function () {
			var links = document.getElementsByTagName("link");
			for (var i=0; i < links.length; i++) {
				if (links[i].rel === "stylesheet") {
					if (links[i].href.indexOf("?")===-1) {
						links[i].href += "?";
					}
					links[i].href += "x";
				}
			}
		});


		$('#kiwi .about .about_close').click(function () {
			$('#kiwi .about').css('display', 'none');
		});
		
		
		$('#kiwi .poweredby').click(function () {
			$('#kiwi .about').css('display', 'block');
		});
		
	},
	
	
	tabviewExists: function (name) {
		return !(front.tabviews[name.toLowerCase()] == undefined);
	},
	
	tabviewAdd: function (v_name) {
		if (v_name.charAt(0) == gateway.channel_prefix) {
			var re = new RegExp(gateway.channel_prefix,"g");
			var htmlsafe_name = v_name.replace(re, 'pre');
			htmlsafe_name = "chan_" + htmlsafe_name;
		} else {
			var htmlsafe_name = 'query_' + v_name;
		}
		
		var tmp_divname = 'kiwi_window_' + htmlsafe_name;
		var tmp_userlistname = 'kiwi_userlist_' + htmlsafe_name;
		var tmp_tabname = 'kiwi_tab_' + htmlsafe_name
		
		$('#kiwi').append('<div id="' + tmp_divname + '" class="messages"></div>');
		$('#kiwi .userlist').append('<ul id="' + tmp_userlistname + '"></ul>');
		$('#kiwi .windowlist ul').append('<li id="' + tmp_tabname + '" onclick="front.tabviews[\'' + v_name.toLowerCase() + '\'].show();">' + v_name + '</li>');
		//$('#kiwi .windowlist ul .window_'+v_name).click(function(){ front.windowShow(v_name); });
		//front.windowShow(v_name);
		
		front.tabviews[v_name.toLowerCase()] = new tabview();
		front.tabviews[v_name.toLowerCase()].name = v_name;
		front.tabviews[v_name.toLowerCase()].div = $('#'+tmp_divname);
		front.tabviews[v_name.toLowerCase()].userlist = $('#'+tmp_userlistname);
		front.tabviews[v_name.toLowerCase()].tab = $('#'+tmp_tabname);
		front.tabviews[v_name.toLowerCase()].show();
		
		if (typeof registerTouches === "function") {
			//alert("Registering touch interface");
			//registerTouches($('#'+tmp_divname));
			registerTouches(document.getElementById(tmp_divname));
		}
		/*
		front.tabviews[v_name.toLowerCase()].userlist.click(function(){
			alert($(this).attr('id'));
		});
		*/

		front.doLayoutSize();
	},
	
	
	userClick: function (item) {
		// Remove any existing userboxes
		$('#kiwi .userbox').remove();
		
		var li = $(item).parent();
		var html = '<div class="userbox">\
	<input type="hidden" class="userbox_nick" value="' + front.nickStripPrefix($(item).text()) + '" />\
	<a href="#" class="userbox_query">Message</a>\
	<a href="#" class="userbox_whois">Info</a>\
</div>';
		li.append(html);
		
		$('#kiwi .userbox .userbox_query').click(function (ev) {
			var nick = $('#kiwi .userbox_nick').val();
			front.run('/query ' + nick);
		});
		
		$('#kiwi .userbox .userbox_whois').click(function (ev) {
			var nick = $('#kiwi .userbox_nick').val();
			front.run('/whois ' + nick);
		});
	},
	
	
	sync: function () {
		gateway.sync();
	},
	
	onSync: function (e, data) {
		// Set any settings
		if (data.nick != undefined) gateway.nick = data.nick;
		
		// Add the tabviews
		if (data.tabviews != undefined) {
			$.each(data.tabviews, function (i, tab) {
				if(!front.tabviewExists(tab.name)){
					front.tabviewAdd(gateway.channel_prefix + tab.name);
					
					if (tab.userlist !== undefined)
						front.onUserList({'channel':gateway.channel_prefix + tab.name, 'users':tab.userlist});
				}
			});
		}
		
		front.doLayout();
	},
	
	
	setTopicText: function (new_topic) {
		$('#kiwi .cur_topic').text(new_topic);
	},
	
	
	
	
	
	
	
	nickStripPrefix: function (nick) {
		var tmp = nick;
		
		prefix = tmp.charAt(0);
		if (typeof gateway.user_prefixes[prefix] != "undefined") tmp = tmp.substring(1);
		
		return tmp;
	},
	
	nickGetPrefix: function (nick) {
		var tmp = nick;
		
		prefix = tmp.charAt(0);
		if (typeof gateway.user_prefixes[prefix] == "undefined") {
			prefix = "";
		}
		
		return prefix;
	},
	
	isChannel: function (name) {
		prefix = name.charAt(0);
		if (gateway.channel_prefix.indexOf(prefix) > -1) {
			is_chan = true;
		} else {
			is_chan = false;
		}
		
		return is_chan;
	},
	
	tabviewsNext: function(){
		var wl = $('#kiwi .windowlist ul');
		var next_left = parseInt(wl.css('text-indent').replace('px', ''))+170;
		wl.css('text-indent', next_left);
	},
	
	tabviewsPrevious: function(){
		var wl = $('#kiwi .windowlist ul');
		var next_left = parseInt(wl.css('text-indent').replace('px', ''))-170;
		wl.css('text-indent', next_left);
	},

	windowsNext: function(){
		var tab, next;
		next = false;
		for(tab in front.tabviews){
			if(!next){
				if(front.tabviews[tab] == front.cur_channel){
					next = true;
					continue;
				}
			} else {
				front.tabviews[tab].show();
			}
		};
	},

	windowsPrevious: function(){
		var tab, prev_tab, next;
		next = false;
		for(tab in front.tabviews){
			if(front.tabviews[tab] == front.cur_channel){
				prev_tab.show();
				return;
			}
			prev_tab = front.tabviews[tab];
		};
	}
}

















/*
 *
 *   TABVIEWS
 *
 */


var tabview = function(){}
tabview.prototype.name = null;
tabview.prototype.div = null;
tabview.prototype.userlist = null;
tabview.prototype.tab = null;
tabview.prototype.topic = "";

tabview.prototype.show = function(){
	$('#kiwi .messages').removeClass("active");
	$('#kiwi .userlist ul').removeClass("active");
	$('#kiwi .windowlist ul li').removeClass("active");
	
	// Activate this tab!
	this.div.addClass('active');
	this.userlist.addClass('active');
	this.tab.addClass('active');
	
	document.tmp = this.div;
	// Add the part image to the tab
	this.addPartImage();
	
	this.clearHighlight();
	front.setTopicText(this.topic);
	front.cur_channel = this;
	
	this.scrollBottom();
	if(!touchscreen) $('#kiwi_msginput').focus();
}

tabview.prototype.close = function(){
	this.div.remove();
	this.userlist.remove();
	this.tab.remove();
	
	front.tabviews['server'].show();
	delete front.tabviews[this.name.toLowerCase()];
}

tabview.prototype.addPartImage = function(){
	this.clearPartImage();
	
	var del_html = '<img src="img/redcross.png" class="tab_part" />';
	this.tab.append(del_html);
	
	$('.tab_part', this.tab).click(function(){
		if(front.isChannel($(this).parent().text())){
			front.run("/part");
		} else {
			// Make sure we don't close the server tab
			if(front.cur_channel.name != "server") front.cur_channel.close();
		}
	});
}

tabview.prototype.clearPartImage = function(){
	$('#kiwi .windowlist .tab_part').remove();
}

tabview.prototype.addMsg = function(time, nick, msg, type, style){
	//if(nick.charAt(0) != "[" && nick != ""){
	//	var html_nick = $('<div/>').text('<'+nick+'>').html();
	//} else {
		var html_nick = $('<div/>').text(nick).html();
	//}
	
	var self = this;
	
	var tmp = msg;
	var plugin_ret = '';
	for(var i in plugins.privmsg){
		if ((plugins.privmsg[i].onprivmsg instanceof Function)) {
			plugin_ret = '';
			try {
				plugin_ret = plugins.privmsg[i].onprivmsg(tmp, this.name);
				
				// If this plugin has returned false, do not add this message
				if(plugin_ret === false) return;
			} catch (e){}
			
			// If we actually have a string from the plugin, use it
			if(typeof plugin_ret == "string") tmp = plugin_ret;
		}
	}
	msg = tmp;
	
	//var html_msg = $('<div/>').text(msg).html()+' '; // Add the space so the styling always has at least 1 character to go from
	if(time == null){
		var d = new Date();
		time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");
	}
	
	// The CSS class (action, topic, notice, etc)
	if(typeof type != "string") type = '';
	
	// Make sure we don't have NaN or something
	if(typeof msg != "string") msg = '';
	
	// Text formatting
	// bold
	if(msg.indexOf(String.fromCharCode(2))){
		next = '<b>';
		while(msg.indexOf(String.fromCharCode(2)) != -1){
			msg = msg.replace(String.fromCharCode(2), next);
			next = (next=='<b>') ? '</b>' : '<b>';
		}
		if(next == '</b>') msg =+ '</b>';
	}
	
	// Wierd thing noticed by Dux0r on the irc.esper.net server
	if(typeof msg != "string") msg = '';
	
	// underline
	if(msg.indexOf(String.fromCharCode(31))){
		next = '<u>';
		while(msg.indexOf(String.fromCharCode(31)) != -1){
			msg = msg.replace(String.fromCharCode(31), next);
			next = (next=='<u>') ? '</u>' : '<u>';
		}
		if(next == '</u>') msg =+ '</u>';
	}
	
	
	var line_msg = '<div class="msg '+type+'"><div class="time">'+time+'</div><div class="nick">'+html_nick+'</div><div class="text" style="'+style+'">'+msg+' </div></div>';
	this.div.append(line_msg);
	this.scrollBottom();
}

tabview.prototype.scrollBottom = function(){
	this.div.attr({ scrollTop: this.div.attr("scrollHeight") });
}

tabview.prototype.changeNick = function(newNick, oldNick){
	this.userlist.children().each(function(){
		var item = $('a.nick', this);
		if(front.nickStripPrefix(item.text()) == oldNick){
			item.text(front.nickGetPrefix(item.text())+newNick);
			document.temp_chan = 1;
		}
	});
	
	if(typeof document.temp_chan != "undefined"){
		this.addMsg(null, ' ', '=== '+oldNick+' is now known as '+newNick, 'action');
		delete document.temp_chan;
		this.userlistSort();
	}
}

tabview.prototype.userlistSort = function(){
	var ul = this.userlist;
	var listitems = ul.children('li').get();
	listitems.sort(function(a, b) {
		var compA = $(a).text().toUpperCase();
		var compB = $(b).text().toUpperCase();
		
		// Sort by prefixes first
		for (var prefix in gateway.user_prefixes) {
			mode = gateway.user_prefixes[prefix];
			
			if(compA.charAt(0) == prefix && compB.charAt(0) == prefix){
				// Both have the same prefix, string compare time
				return 0;
			}
			
			if(compA.charAt(0) == prefix && compB.charAt(0) != prefix){
				return -1;
			}
			
			if(compA.charAt(0) != prefix && compB.charAt(0) == prefix){
				return 1;
			}
		}
			   
		// No prefixes, compare by string
		return (compA < compB) ? -1 : (compA > compB) ? 1 : 0;
	})
	$.each(listitems, function(idx, itm) { ul.append(itm); });
}

tabview.prototype.highlight = function(){
	this.tab.addClass('highlight');
}
tabview.prototype.activity = function(){
	this.tab.addClass('activity');
}
tabview.prototype.clearHighlight = function(){
	this.tab.removeClass('highlight');
	this.tab.removeClass('activity');
}
tabview.prototype.changeTopic = function(new_topic){
	this.topic = new_topic;
	this.addMsg(null, ' ', '=== Topic for '+this.name+' is: '+new_topic, 'topic');
	if(front.cur_channel.name == this.name) front.setTopicText(new_topic);
}





var box = function(classname){
	this.id = randomString(10);
	var tmp = $('<div id="'+this.id+'" class="box '+classname+'"><div class="boxarea"></div></div>');
	$('#kiwi').append(tmp);
	this.box = $('#'+this.id);
	this.content = $('#'+this.id+' .boxarea');
	
	this.box.draggable({ stack: ".box" });
	this.content.click(function(){});
	//this.box.click(function(){ $(this)..css });
}
box.prototype.create = function(name, classname){
	
}
box.prototype.id = null;
box.prototype.box = null;
box.prototype.content = null;
box.prototype.destroy = function(){
	this.box.remove();
	for (var name in front.boxes) if(front.boxes[name].id = this.id) delete front.boxes[name];
}
box.prototype.height = function(){ return this.box.height(); }

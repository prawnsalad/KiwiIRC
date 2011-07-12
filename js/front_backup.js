var front = {
	cur_channel: '',
	windows: {},
	
	
	init: function(){
		front.registerKeys();
		
		gateway.nick = 'kiwiclone';
		gateway.session_id = null;
		gateway.onMsg = front.onMsg;
		gateway.onNotice = front.onNotice;
		gateway.onMOTD = front.onMOTD;
		gateway.onConnect = front.onConnect;
		gateway.onUserList = front.onUserList;
		
		front.doLayout();
		front.windowAdd('server');
		gateway.poll();
	},
	
	doLayout: function(){
		$('#kiwi .msginput .nick a').text(gateway.nick);
	},
	
	
	onMsg: function(data){
		front.addMsg(null, data.nick,data.msg,data.channel);
	},
	onNotice: function(data){
		front.addMsg(null, data.nick,  '--> '+data.msg);
	},
	onConnect: function(data){
		if(data.connected){
			front.addMsg(null, ' ', '--> Connected to '+data.host);
		} else {
			front.addMsg(null, ' ', '--> Failed to connect to '+data.host);
		}
	},
	onMOTD: function(data){
		front.addMsg(null, data.server, data.msg);
	},
	onUserList: function(data){
		$.each(data.users, function(i,item){
			$('<li>'+i+'</li>').appendTo('#kiwi .userlist ul');
		});
	},
	
	registerKeys: function(){
		$('input').keypress(function(e){
			if(e.which == 13){
				var msg = $('#kiwi_msginput').val();
				if(msg.substring(0,1) == '/'){
					var parts = msg.split(' ');
					switch(parts[0]){
						case '/join':
							if(front.windows[parts[1]] == undefined){
								gateway.join(parts[1].replace('#', ''));
								front.windowAdd(parts[1]);
							} else {
								front.windowShow(parts[1]);
							}
							break;
							
						case '/connect':
							if(parts[1] == undefined){
								alert('Usage: /connect servername [port]');
								break;
							}
							
							if(parts[2] == undefined) parts[2] = 6667;
							front.addMsg(null, ' ', '--> Connecting to '+parts[1]+'...');
							gateway.connect(parts[1], parts[2], 0);
							break;
						
						default:
							front.addMsg(null, ' ', '--> Invalid command: '+parts[0].substring(1));
					}
					
				} else {
					gateway.msg(front.cur_channel, msg);
					var d = new Date();
					var d = d.getHours() + ":" + d.getMinutes();
					front.addMsg(d, gateway.nick, msg);
				}
				$('#kiwi_msginput').val('');
			}
		});
	},
	
	
	
	addMsg: function(time, nick, msg, channel){
		var html_nick = $('<div/>').text(nick).html();
		var html_msg = $('<div/>').text(msg).html()+' '; // Add the space so the styling always has at least 1 character to go from
		if(time == null){
			var d = new Date();
			time = d.getHours() + ":" + d.getMinutes();
		}
		
		var msg = '<div class="msg"><div class="time">'+time+'</div><div class="nick">'+html_nick+'</div><div class="text">'+html_msg+'</div></div>';
		if(channel == undefined){
			var messages = $("#kiwi_window_server");
		} else {
			var messages = $("#kiwi_window_chan_"+channel.replace('#', ''));
		}
		messages.append(msg);
		messages.attr({ scrollTop: messages.attr("scrollHeight") });
	},
	
	
	
	windowExists: function(name){
		return !(front.windows[name] == undefined);
	},
	windowAdd: function(v_name){
		var tmp_divname = 'kiwi_window_'+v_name.replace('#', 'chan_');
		front.windows[v_name] = { name: v_name, div_id: tmp_divname };
		$('#kiwi').append('<div id="'+tmp_divname+'"class="messages"></div>');
		$('#kiwi .windowlist ul').append('<li class="window_'+v_name+'"><a onclick="front.windowShow(\''+v_name+'\');">'+v_name+'</a></li>');
		//$('#kiwi .windowlist ul .window_'+v_name).click(function(){ front.windowShow(v_name); });
		front.windowShow(v_name);
		
		/*
		var t = "";
		for (key in front.windows)
			t += "Element value is " + front.windows[key].div_id + "\n";
			
		alert(t);
		*/
	},
	windowDiv: function(name){
		if(!front.windowExists(name)) return false;
		return $('#'+front.windows[name].div_id);
	},
	windowShow: function(name){
		if(!front.windowExists(name)) return false;
		$('#kiwi .messages').removeClass("active");
		var tmp = front.windowDiv(name);
		tmp.addClass('active');
		front.cur_channel = name;
	}
}
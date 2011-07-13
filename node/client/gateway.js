var gateway = {

	revision: 16,

	nick: 'kiwi',
	session_id: null,
	syncing: false,
	channel_prefix: '#',
	network_name: '',
	user_prefixes: [],
    socket: null,

	
	/*connect: function(s_host, s_port, s_ssl, callback){
		var data = {
			method: 'connect',
			args: {
				server: s_host,
				port: s_port,
				ssl: s_ssl,
				nick: this.nick
			}
		};
		
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},*/
	connect: function(host,port,ssl,callback) {
        socket.emit('irc connect', this.nick, host, port, ssl, callback);
    },
	
	
	
	/*start: function(){
		if(typeof WebSocket != "undefined"){
			//alert("Starting websocket support..");
			gateway.socket();
		} else {
			//alert("Starting polling support..");
			gateway.poll();
		}
	},*/
	start: function() {
        socket = io.connect('http://192.168.1.127:7777/');
        socket.on('connection',function() {
            gateway.sendData = function(data,callback) {
                socket.send({sid:this.session_id,data:$.toJSON(data)},callback);
            }
            socket.on('message', function(msg) {
			    gateway.buffer += msg;
			
			    if(gateway.buffer.indexOf("\n") > 0){
				    var msgs = gateway.buffer.split("\n");
				    for(var i=0; i<msgs.length; i++){
					    if(msgs[i].substring(msgs[i].length-1) != "}"){
						    gateway.buffer = msgs[i];
						    continue;
					    }
					
					    cmd = (msgs[i].charCodeAt(0) == 0) ? msgs[i].substring(1) : msgs[i];
					    console.log(cmd.charCodeAt(0)+"-"+cmd+"-"+cmd.charCodeAt(cmd.length-1));
					    obj = eval("("+cmd+")");
					    gateway.parse(obj);
				    }
			    }
		    });
        });
	},

	/*poll: function(){
		if(this.session_id == null){
			gateway.sendData = function(data, callback){
				data = {
					sid: this.session_id,
					data: $.toJSON(data)
				}
				$.post('poll.php', data, callback, 'json');
			}
			
			$.post("poll.php", {},
				function(data, status){
					if(data.session_id != undefined){
						gateway.session_id = data.session_id;
						gateway.poll();
					} else {
						if(typeof data.error == "string"){
							alert(data.error);
						} else {
							alert('Woops, something went wrong! Unsure what it is though.. :(');
						}
					}
				}, 'json'
			);
			return;
		}
		$.post("poll.php", {sid: this.session_id},
			function(data, status){
				$.each(data, function(i,item){
					gateway.parse(item);
				});
				gateway.poll(gateway.session_id);
			}, 'json');
	},
	
	
	socket: function(){
		gateway.buffer = "";
		
		gateway.conn = new WebSocket("ws://127.0.0.1:7777/client");
		
		gateway.sendData = function(data, callback){
			gateway.conn.send($.toJSON(data));
			if(typeof callback == "function") callback();
		}
		
		//gateway.conn.onopen = function(evt) { alert("Conn opened"); }
		gateway.conn.onmessage = function(evt) {
			gateway.buffer += evt.data;
			
			if(gateway.buffer.indexOf("\n") > 0){
				var msgs = gateway.buffer.split("\n");
				for(var i=0; i<msgs.length; i++){
					if(msgs[i].substring(msgs[i].length-1) != "}"){
						gateway.buffer = msgs[i];
						continue;
					}
					
					cmd = (msgs[i].charCodeAt(0) == 0) ? msgs[i].substring(1) : msgs[i];
					console.log(cmd.charCodeAt(0)+"-"+cmd+"-"+cmd.charCodeAt(cmd.length-1));
					obj = eval("("+cmd+")");
					gateway.parse(obj);
				}
			}
		}
		//gateway.conn.onclose = function(evt) { alert("Conn closed"); }
	},*/
	
	
	
	
	
	
	
	
	
	/*
		Events:
			msg
			action
			server_connect
			options
			motd
			notice
			userlist
			nick
			join
			topic
			part
			kick
			quit
			whois
			syncchannel_redirect
			debug
	*/
	parse: function(item){
		if(item.event != undefined){
			$(gateway).trigger("on"+item.event, item);
			
			switch(item.event){
				case 'options':
					$.each(item.options, function(name,value){
						switch(name){
							case 'CHANTYPES':
								gateway.channel_prefix = value.charAt(0);
								break;
							case 'NETWORK':
								gateway.network_name = value;
								break;
							case 'PREFIX':
								gateway.user_prefixes = value;
								break;
						}
					});
					break;
				
				case 'sync':
					if(gateway.onSync && gateway.syncing){
						gateway.syncing = false;
						gateway.onSync(item);
					}
					break;

			}
		}
	},
	
	sendData: function(){},
	
	
	
	
	
	
	
	
	
	
	
	sync: function(callback){
		if(this.session_id == null) return;
		
		var data = {
			method: 'sync',
			args: {}
		};
		
		gateway.syncing = true;
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},
	
	debug: function(){
		var data = {
			method: 'debug',
			args: {}
		};
		
		//$.post('poll.php', data, function(){}, 'json');
		gateway.sendData(data, callback);
	},
	
	
	msg: function(s_target, s_msg, callback){
		var data = {
			method: 'msg',
			args: {
				target: s_target,
				msg: s_msg
			}
		};
		
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},
	
	action: function(s_target, s_msg, callback){
		var data = {
			method: 'action',
			args: {
				target: s_target,
				msg: s_msg
			}
		};
		
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},
	
	
	join: function(s_channel, callback){
		var data = {
			method: 'join',
			args: {
				channel: s_channel,
			}
		};
		
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},
	
	
	raw: function(v_data, callback){
		var data = {
			method: 'raw',
			args: {
				data: v_data,
			}
		};
		
		//$.post('poll.php', data, callback, 'json');
		gateway.sendData(data, callback);
	},
	
	
	quit: function(msg){
		alert("closing");
		msg = "";
		var data = {
			method: 'quit',
			args: {
				message: msg,
			}
		};
		
		gateway.sendData(data, callback);
	}
	
	
	

};

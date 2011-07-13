var tls = require('tls'),
    net = require("net"),
    http = require('http'),
    ws =  require("socket.io");

//setup websocket listener
io = ws.listen(7777);
io.sockets.on('connection',function(websocket) {
    websocket.on('irc connect',function(nick,host,port,ssl,callback) {
        console.log(websocket);
        //setup IRC connection
        if(!ssl) {
            ircSocket = net.createConnection(port,host);
        }
        else {
            ircSocket = tls.connect(port,host);
        }
        ircSocket.setEncoding('ascii');
        
        ircSocket.on('data',function(data) {
            console.log(data);
        });
        
        // Send the login data
        ircSocket.write('NICK '+nick+'\r\n');
        ircSocket.write('USER '+nick+'_kiwi 0 0 :'+nick+'\r\n');
        
        if((callback)&&(typeof(callback) == 'function')) {
            callback();
        }
    });
    websocket.on('message',function(msg,callback) {
        console.log(msg);
        if((callback)&&(typeof(callback) == 'function')) {
            callback();
        }
    });
});

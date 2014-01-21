var Proxy = require('./server/proxy');

var serv = new Proxy.ProxyServer();
serv.listen(7779, '127.0.0.1');
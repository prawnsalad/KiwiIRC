
var express = require('express')
  , stylus = require('stylus');

var app = express.createServer();

app.configure(function () {
  app.use(stylus.middleware({ src: __dirname + '/public/css' }));
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');
});

app.get('/', function (req, res) {
  res.render('index');
});

app.get('/new', function (req, res) {
  res.render('new');
});

app.listen(3000);

// Target API:
//
//  var s = require('net').createStream(25, 'smtp.example.com');
//  s.on('connect', function() {
//   require('starttls')(s, options, function() {
//      if (!s.authorized) {
//        s.destroy();
//        return;
//      }
//
//      s.end("hello world\n");
//    });
//  });
//
//
module.exports = function starttls(socket, options, cb) {

  var sslcontext = require('crypto').createCredentials(options);

  var pair = require('tls').createSecurePair(sslcontext, false);

  var cleartext = pipe(pair, socket);

  pair.on('secure', function() {
    var verifyError = pair.ssl.verifyError();

    if (verifyError) {
      cleartext.authorized = false;
      cleartext.authorizationError = verifyError;
    } else {
      cleartext.authorized = true;
    }

    if (cb) cb();
  });

  cleartext._controlReleased = true;
  return cleartext;
};


function pipe(pair, socket) {
  pair.encrypted.pipe(socket);
  socket.pipe(pair.encrypted);

  pair.fd = socket.fd;
  var cleartext = pair.cleartext;
  cleartext.socket = socket;
  cleartext.encrypted = pair.encrypted;
  cleartext.authorized = false;

  function onerror(e) {
    if (cleartext._controlReleased) {
      cleartext.emit('error', e);
    }
  }

  function onclose() {
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
  }

  socket.on('error', onerror);
  socket.on('close', onclose);

  return cleartext;
}


var stream          = require('stream'),
    util            = require('util'),
    iconv           = require('iconv-lite');

// Break the Node.js version down into usable parts
var version_values = process.version.substr(1).split('.').map(function (item) {
    return parseInt(item, 10);
});

// If this version of node is older than 0.10.x, bring in the streams2 shim
if (version_values[0] === 0 && version_values[1] < 10) {
    stream = require('readable-stream');
}

function Transcoder(encoding) {
    this.encoding = encoding || global.config.default_encoding || 'utf8';

    this.in = new ToUTF8(this);
    this.out = new FromUTF8(this);
}

module.exports = Transcoder;

Transcoder.prototype.setEncoding = function(new_encoding) {
    var encoded_test;

    try {
        encoded_test = iconv.encode("TEST", new_encoding);
        // This test is done to check if this encoding also supports
        // the ASCII charset required by the IRC protocol
        // (Avoid the use of base64 or incompatible encodings)
        if (encoded_test === "TEST") {
            this.encoding = new_encoding;
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

function ToUTF8(transcoder) {
    stream.Transform.call(this);
    this.transcoder = transcoder;
}
util.inherits(ToUTF8, stream.Transform);

ToUTF8.prototype._transform = function (chunk, encoding, callback) {
    var decoded;
    try {
        decoded = iconv.decode(chunk, this.transcoder.encoding);
        this.push(decoded);
        callback();
    } catch (err) {
        callback(err);
    }
};

function FromUTF8(transcoder) {
    stream.Transform.call(this);
    this.transcoder = transcoder;
}
util.inherits(FromUTF8, stream.Transform);

FromUTF8.prototype._transform = function (chunk, encoding, callback) {
    var encoded;
    try {
        encoded = iconv.encode(chunk, this.transcoder.encoding);
        this.push(encoded);
        callback();
    } catch (err) {
        callback(err);
    }
};

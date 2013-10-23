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

var IrcParser = function (options) {
    stream.Transform.call(this);
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;

    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = null;

    this.irc_encoding = options.ircEncoding || 'utf8';
};

util.inherits(IrcParser, stream.Transform);

module.exports = IrcParser;

IrcParser.prototype._transform = function (data, encoding, callback) {
    var data_pos,               // Current position within the data Buffer
    line_start = 0,
    lines = [],
    i,
    max_buffer_size = 1024; // 1024 bytes is the maximum length of two RFC1459 IRC messages.
                            // May need tweaking when IRCv3 message tags are more widespread

    // Split data chunk into individual lines
    for (data_pos = 0; data_pos < data.length; data_pos++) {
        if (data[data_pos] === 0x0A) { // Check if byte is a line feed
            lines.push(data.slice(line_start, data_pos));
            line_start = data_pos + 1;
        }
    }

    // No complete lines of data? Check to see if buffering the data would exceed the max buffer size
    if (!lines[0]) {
        if ((this.held_data ? this.held_data.length : 0 ) + data.length > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
        } else {

            // Append the incomplete line to our held_data and wait for more
            if (this.held_data) {
                this.held_data = Buffer.concat([this.held_data, data], this.held_data.length + data.length);
            } else {
                this.held_data = data;
            }
        }

        // No complete lines to process..
        return;
    }

    // If we have an incomplete line held from the previous chunk of data
    // merge it with the first line from this chunk of data
    if (this.hold_last && this.held_data !== null) {
        lines[0] = Buffer.concat([this.held_data, lines[0]], this.held_data.length + lines[0].length);
        this.hold_last = false;
        this.held_data = null;
    }

    // If the last line of data in this chunk is not complete, hold it so
    // it can be merged with the first line from the next chunk
    if (line_start < data_pos) {
        if ((data.length - line_start) > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
            return;
        }

        this.hold_last = true;
        this.held_data = new Buffer(data.length - line_start);
        data.copy(this.held_data, 0, line_start);
    }

    // Process our data line by line
    for (i = 0; i < lines.length; i++) {
        parseIrcLine.call(this, lines[i]);
    }

    callback();
};

IrcParser.prototype.setIrcEncoding = function (new_encoding) {
    this.irc_encoding = new_encoding;
};

/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:(@[^ ]+) )?):(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-*]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-*]+)!([^\x00\r\n\ ]+?)@?([a-z0-9\.\-:\/_]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.+))?$/i;

function parseIrcLine(buffer_line) {
    var msg,
        i,
        tags = [],
        tag,
        line = '';

    // Decode server encoding
    line = iconv.decode(buffer_line, this.irc_encoding);
    if (!line) {
        return;
    }

    // Parse the complete line, removing any carriage returns
    msg = parse_regex.exec(line.replace(/^\r+|\r+$/, ''));

    if (!msg) {
        // The line was not parsed correctly, must be malformed
        console.log('Malformed IRC line: ' + line.replace(/^\r+|\r+$/, ''));
        return;
    }

    // Extract any tags (msg[1])
    if (msg[1]) {
        tags = msg[1].split(';');

        for (i = 0; i < tags.length; i++) {
            tag = tags[i].split('=');
            tags[i] = {tag: tag[0], value: tag[1]};
        }
    }

    msg = {
        tags:       tags,
        prefix:     msg[2],
        nick:       msg[3],
        ident:      msg[4],
        hostname:   msg[5] || '',
        command:    msg[6],
        params:     msg[7] || '',
        trailing:   (msg[8]) ? msg[8].trim() : ''
    };

    msg.params = msg.params.split(' ');
    this.push(msg);
}

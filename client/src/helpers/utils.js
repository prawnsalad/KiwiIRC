/*jslint devel: true, browser: true, continue: true, sloppy: true, forin: true, plusplus: true, maxerr: 50, indent: 4, nomen: true, regexp: true*/
/*globals $, front, gateway, Utilityview */



/**
*   Generate a random string of given length
*   @param      {Number}    string_length   The length of the random string
*   @returns    {String}                    The random string
*/
function randomString(string_length) {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",
        randomstring = '',
        i,
        rnum;
    for (i = 0; i < string_length; i++) {
        rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
}

/**
*   String.trim shim
*/
if (typeof String.prototype.trim === 'undefined') {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, "");
    };
}

/**
*   String.lpad shim
*   @param      {Number}    length      The length of padding
*   @param      {String}    characher   The character to pad with
*   @returns    {String}                The padded string
*/
if (typeof String.prototype.lpad === 'undefined') {
    String.prototype.lpad = function (length, character) {
        var padding = "",
            i;
        for (i = 0; i < length; i++) {
            padding += character;
        }
        return (padding + this).slice(-length);
    };
}


/**
*   Convert seconds into hours:minutes:seconds
*   @param      {Number}    secs    The number of seconds to converts
*   @returns    {Object}            An object representing the hours/minutes/second conversion of secs
*/
function secondsToTime(secs) {
    var hours, minutes, seconds, divisor_for_minutes, divisor_for_seconds, obj;
    hours = Math.floor(secs / (60 * 60));

    divisor_for_minutes = secs % (60 * 60);
    minutes = Math.floor(divisor_for_minutes / 60);

    divisor_for_seconds = divisor_for_minutes % 60;
    seconds = Math.ceil(divisor_for_seconds);

    obj = {
        "h": hours,
        "m": minutes,
        "s": seconds
    };
    return obj;
}


/* Command input Alias + re-writing */
function InputPreProcessor () {
    this.recursive_depth = 3;

    this.aliases = {};
    this.vars = {version: 1};

    // Current recursive depth
    var depth = 0;


    // Takes an array of words to process!
    this.processInput = function (input) {
        var words = input || [],
            alias = this.aliases[words[0]],
            alias_len,
            current_alias_word = '',
            compiled = [];

        // If an alias wasn't found, return the original input
        if (!alias) return input;

        // Split the alias up into useable words
        alias = alias.split(' ');
        alias_len = alias.length;

        // Iterate over each word and pop them into the final compiled array.
        // Any $ words are processed with the result ending into the compiled array.
        for (var i=0; i<alias_len; i++) {
            current_alias_word = alias[i];

            // Non $ word
            if (current_alias_word[0] !== '$') {
                compiled.push(current_alias_word);
                continue;
            }

            // Refering to an input word ($N)
            if (!isNaN(current_alias_word[1])) {
                var num = current_alias_word.match(/\$(\d+)(\+)?(\d+)?/);

                // Did we find anything or does the word it refers to non-existant?
                if (!num || !words[num[1]]) continue;

                if (num[2] === '+' && num[3]) {
                    // Add X number of words
                    compiled = compiled.concat(words.slice(parseInt(num[1], 10), parseInt(num[1], 10) + parseInt(num[3], 10)));
                } else if (num[2] === '+') {
                    // Add the remaining of the words
                    compiled = compiled.concat(words.slice(parseInt(num[1], 10)));
                } else {
                    // Add a single word
                    compiled.push(words[parseInt(num[1], 10)]);
                }

                continue;
            }


            // Refering to a variable
            if (typeof this.vars[current_alias_word.substr(1)] !== 'undefined') {

                // Get the variable
                compiled.push(this.vars[current_alias_word.substr(1)]);

                continue;
            }

        }

        return compiled;
    };


    this.process = function (input) {
        input = input || '';

        var words = input.split(' ');

        depth++;
        if (depth >= this.recursive_depth) {
            depth--;
            return input;
        }

        if (this.aliases[words[0]]) {
            words = this.processInput(words);

            if (this.aliases[words[0]]) {
                words = this.process(words.join(' ')).split(' ');
            }

        }

        depth--;
        return words.join(' ');
    };
}


/**
 * Convert HSL to RGB formatted colour
 */
function hsl2rgb(h, s, l) {
    var m1, m2, hue;
    var r, g, b
    s /=100;
    l /= 100;
    if (s == 0)
        r = g = b = (l * 255);
    else {
        function HueToRgb(m1, m2, hue) {
            var v;
            if (hue < 0)
                hue += 1;
            else if (hue > 1)
                hue -= 1;

            if (6 * hue < 1)
                v = m1 + (m2 - m1) * hue * 6;
            else if (2 * hue < 1)
                v = m2;
            else if (3 * hue < 2)
                v = m1 + (m2 - m1) * (2/3 - hue) * 6;
            else
                v = m1;

            return 255 * v;
        }
        if (l <= 0.5)
            m2 = l * (s + 1);
        else
            m2 = l + s - l * s;
        m1 = l * 2 - m2;
        hue = h / 360;
        r = HueToRgb(m1, m2, hue + 1/3);
        g = HueToRgb(m1, m2, hue);
        b = HueToRgb(m1, m2, hue - 1/3);
    }
    return [r,g,b];
}


/**
 * Formats a kiwi message to IRC format
 */
function formatToIrcMsg(message) {
    // Format any colour codes (eg. $c4)
    message = message.replace(/%C(\d)/ig, function(match, colour_number) {
        return String.fromCharCode(3) + colour_number.toString();
    });

    var formatters = {
        B: '\x02',    // Bold
        I: '\x1D',    // Italics
        U: '\x1F',    // Underline
        O: '\x0F'     // Out / Clear formatting
    };
    message = message.replace(/%([BIUO])/ig, function(match, format_code) {
        if (typeof formatters[format_code.toUpperCase()] !== 'undefined')
            return formatters[format_code.toUpperCase()];
    });

    return message;
}


/**
*   Formats a message. Adds bold, underline and colouring
*   @param      {String}    msg The message to format
*   @returns    {String}        The HTML formatted message
*/
function formatIRCMsg (msg) {
    "use strict";
    var out = '',
        currentTag = '',
        openTags = {
            bold: false,
            italic: false,
            underline: false,
            colour: false
        },
        spanFromOpen = function () {
            var style = '',
                colours;
            if (!(openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                return '';
            } else {
                style += (openTags.bold) ? 'font-weight: bold; ' : '';
                style += (openTags.italic) ? 'font-style: italic; ' : '';
                style += (openTags.underline) ? 'text-decoration: underline; ' : '';
                if (openTags.colour) {
                    colours = openTags.colour.split(',');
                    style += 'color: ' + colours[0] + ((colours[1]) ? '; background-color: ' + colours[1] + ';' : '');
                }
                return '<span class="format_span" style="' + style + '">';
            }
        },
        colourMatch = function (str) {
            var re = /^\x03(([0-9][0-9]?)(,([0-9][0-9]?))?)/;
            return re.exec(str);
        },
        hexFromNum = function (num) {
            switch (parseInt(num, 10)) {
            case 0:
                return '#FFFFFF';
            case 1:
                return '#000000';
            case 2:
                return '#000080';
            case 3:
                return '#008000';
            case 4:
                return '#FF0000';
            case 5:
                return '#800040';
            case 6:
                return '#800080';
            case 7:
                return '#FF8040';
            case 8:
                return '#FFFF00';
            case 9:
                return '#80FF00';
            case 10:
                return '#008080';
            case 11:
                return '#00FFFF';
            case 12:
                return '#0000FF';
            case 13:
                return '#FF55FF';
            case 14:
                return '#808080';
            case 15:
                return '#C0C0C0';
            default:
                return null;
            }
        },
        i = 0,
        colours = [],
        match;

    for (i = 0; i < msg.length; i++) {
        switch (msg[i]) {
        case '\x02':
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                out += currentTag + '</span>';
            }
            openTags.bold = !openTags.bold;
            currentTag = spanFromOpen();
            break;
        case '\x1D':
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                out += currentTag + '</span>';
            }
            openTags.italic = !openTags.italic;
            currentTag = spanFromOpen();
            break;
        case '\x1F':
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                out += currentTag + '</span>';
            }
            openTags.underline = !openTags.underline;
            currentTag = spanFromOpen();
            break;
        case '\x03':
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                out += currentTag + '</span>';
            }
            match = colourMatch(msg.substr(i, 6));
            if (match) {
                i += match[1].length;
                // 2 & 4
                colours[0] = hexFromNum(match[2]);
                if (match[4]) {
                    colours[1] = hexFromNum(match[4]);
                }
                openTags.colour = colours.join(',');
            } else {
                openTags.colour = false;
            }
            currentTag = spanFromOpen();
            break;
        case '\x0F':
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                out += currentTag + '</span>';
            }
            openTags.bold = openTags.italic = openTags.underline = openTags.colour = false;
            break;
        default:
            if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
                currentTag += msg[i];
            } else {
                out += msg[i];
            }
            break;
        }
    }
    if ((openTags.bold || openTags.italic || openTags.underline || openTags.colour)) {
        out += currentTag + '</span>';
    }
    return out;
}


function formatDate (d) {
    /* 
    date.format.js
    A JavaScript date format library that uses the same method as PHP's date() function.

    https://github.com/jacwright/date.format
    */
    Date.shortMonths = [_kiwi.global.i18n.translate('client.libs.date_format.short_months.january').fetch(),
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.february').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.march').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.april').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.may').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.june').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.july').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.august').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.september').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.october').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.november').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_months.december').fetch()];
    Date.longMonths = [_kiwi.global.i18n.translate('client.libs.date_format.long_months.january').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.february').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.march').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.april').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.may').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.june').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.july').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.august').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.september').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.october').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.november').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_months.december').fetch()];
    Date.shortDays = [_kiwi.global.i18n.translate('client.libs.date_format.short_days.monday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.tuesday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.wednesday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.thursday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.friday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.saturday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.short_days.sunday').fetch()];
    Date.longDays = [_kiwi.global.i18n.translate('client.libs.date_format.long_days.monday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.tuesday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.wednesday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.thursday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.friday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.saturday').fetch(), 
                        _kiwi.global.i18n.translate('client.libs.date_format.long_days.sunday').fetch()];
    
    // defining patterns
    var replaceChars = {
        // Day
        d: function() { return (this.getDate() < 10 ? '0' : '') + this.getDate(); },
        D: function() { return Date.shortDays[this.getDay()]; },
        j: function() { return this.getDate(); },
        l: function() { return Date.longDays[this.getDay()]; },
        N: function() { return this.getDay() + 1; },
        S: function() { return (this.getDate() % 10 == 1 && this.getDate() != 11 ? 'st' : (this.getDate() % 10 == 2 && this.getDate() != 12 ? 'nd' : (this.getDate() % 10 == 3 && this.getDate() != 13 ? 'rd' : 'th'))); },
        w: function() { return this.getDay(); },
        z: function() { var d = new Date(this.getFullYear(),0,1); return Math.ceil((this - d) / 86400000); }, // Fixed now
        // Week
        W: function() { var d = new Date(this.getFullYear(), 0, 1); return Math.ceil((((this - d) / 86400000) + d.getDay() + 1) / 7); }, // Fixed now
        // Month
        F: function() { return Date.longMonths[this.getMonth()]; },
        m: function() { return (this.getMonth() < 9 ? '0' : '') + (this.getMonth() + 1); },
        M: function() { return Date.shortMonths[this.getMonth()]; },
        n: function() { return this.getMonth() + 1; },
        t: function() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).getDate() }, // Fixed now, gets #days of date
        // Year
        L: function() { var year = this.getFullYear(); return (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)); },   // Fixed now
        o: function() { var d  = new Date(this.valueOf());  d.setDate(d.getDate() - ((this.getDay() + 6) % 7) + 3); return d.getFullYear();}, //Fixed now
        Y: function() { return this.getFullYear(); },
        y: function() { return ('' + this.getFullYear()).substr(2); },
        // Time
        a: function() { return this.getHours() < 12 ? 'am' : 'pm'; },
        A: function() { return this.getHours() < 12 ? 'AM' : 'PM'; },
        B: function() { return Math.floor((((this.getUTCHours() + 1) % 24) + this.getUTCMinutes() / 60 + this.getUTCSeconds() / 3600) * 1000 / 24); }, // Fixed now
        g: function() { return this.getHours() % 12 || 12; },
        G: function() { return this.getHours(); },
        h: function() { return ((this.getHours() % 12 || 12) < 10 ? '0' : '') + (this.getHours() % 12 || 12); },
        H: function() { return (this.getHours() < 10 ? '0' : '') + this.getHours(); },
        i: function() { return (this.getMinutes() < 10 ? '0' : '') + this.getMinutes(); },
        s: function() { return (this.getSeconds() < 10 ? '0' : '') + this.getSeconds(); },
        u: function() { var m = this.getMilliseconds(); return (m < 10 ? '00' : (m < 100 ?
    '0' : '')) + m; },
        // Timezone
        e: function() { return "Not Yet Supported"; },
        I: function() {
            var DST = null;
                for (var i = 0; i < 12; ++i) {
                        var d = new Date(this.getFullYear(), i, 1);
                        var offset = d.getTimezoneOffset();
    
                        if (DST === null) DST = offset;
                        else if (offset < DST) { DST = offset; break; }                     else if (offset > DST) break;
                }
                return (this.getTimezoneOffset() == DST) | 0;
            },
        O: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + '00'; },
        P: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + ':00'; }, // Fixed now
        T: function() { var m = this.getMonth(); this.setMonth(0); var result = this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/, '$1'); this.setMonth(m); return result;},
        Z: function() { return -this.getTimezoneOffset() * 60; },
        // Full Date/Time
        c: function() { return this.format("Y-m-d\\TH:i:sP"); }, // Fixed now
        r: function() { return this.toString(); },
        U: function() { return this.getTime() / 1000; }
    };

    // Simulates PHP's date function
    Date.prototype.format = function(format) {
        var date = this;
        return format.replace(/(\\?)(.)/g, function(_, esc, chr) {
            return (esc === '' && replaceChars[chr]) ? replaceChars[chr].call(date) : chr;
        });
    };
    /* End of date.format */

    d = d || new Date();
    return d.format(_kiwi.global.i18n.translate('client_date_format').fetch());
}

function escapeRegex (str) {
    return str.replace(/[\[\\\^\$\.\|\?\*\+\(\)]/g, '\\$&');
}

function emoticonFromText(str) {
    var words_in = str.split(' '),
        words_out = [],
        i,
        pushEmoticon = function (alt, emote_name) {
            words_out.push('<i class="emoticon ' + emote_name + '">' + alt + '</i>');
        };

    for (i = 0; i < words_in.length; i++) {
        switch(words_in[i]) {
        case ':)':
            pushEmoticon(':)', 'smile');
            break;
        case ':(':
            pushEmoticon(':(', 'sad');
            break;
        case ':3':
            pushEmoticon(':3', 'lion');
            break;
        case ';3':
            pushEmoticon(';3', 'winky_lion');
            break;
        case ':s':
        case ':S':
            pushEmoticon(':s', 'confused');
            break;
        case ';(':
        case ';_;':
            pushEmoticon(';(', 'cry');
            break;
        case ';)':
            pushEmoticon(';)', 'wink');
            break;
        case ';D':
            pushEmoticon(';D"', 'wink_happy');
            break;
        case ':P':
        case ':p':
            pushEmoticon(':P', 'tongue');
            break;
        case 'xP':
            pushEmoticon('xP', 'cringe_tongue');
            break;
        case ':o':
        case ':O':
        case ':0':
            pushEmoticon(':o', 'shocked');
            break;
        case ':D':
            pushEmoticon(':D', 'happy');
            break;
        case '^^':
        case '^.^':
            pushEmoticon('^^,', 'eyebrows');
            break;
        case '&lt;3':
            pushEmoticon('<3', 'heart');
            break;
        case '&gt;_&lt;':
        case '&gt;.&lt;':
            pushEmoticon('>_<', 'doh');
            break;
        case 'XD':
        case 'xD':
            pushEmoticon('xD', 'big_grin');
            break;
        case 'o.0':
        case 'o.O':
            pushEmoticon('o.0', 'wide_eye_right');
            break;
        case '0.o':
        case 'O.o':
            pushEmoticon('0.o', 'wide_eye_left');
            break;
        case ':\\':
        case '=\\':
        case ':/':
        case '=/':
            pushEmoticon(':\\', 'unsure');
            break;
        default:
            words_out.push(words_in[i]);
        }
    }

    return words_out.join(' ');
}

// Code based on http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/#comment-154
function parseISO8601(str) {
    if (Date.prototype.toISOString) {
        return new Date(str);
    } else {
        var parts = str.split('T'),
            dateParts = parts[0].split('-'),
            timeParts = parts[1].split('Z'),
            timeSubParts = timeParts[0].split(':'),
            timeSecParts = timeSubParts[2].split('.'),
            timeHours = Number(timeSubParts[0]),
            _date = new Date();

        _date.setUTCFullYear(Number(dateParts[0]));
        _date.setUTCDate(1);
        _date.setUTCMonth(Number(dateParts[1])-1);
        _date.setUTCDate(Number(dateParts[2]));
        _date.setUTCHours(Number(timeHours));
        _date.setUTCMinutes(Number(timeSubParts[1]));
        _date.setUTCSeconds(Number(timeSecParts[0]));
        if (timeSecParts[1]) {
            _date.setUTCMilliseconds(Number(timeSecParts[1]));
        }

        return _date;
    }
}
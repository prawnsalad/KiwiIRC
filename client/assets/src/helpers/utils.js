/*jslint devel: true, browser: true, continue: true, sloppy: true, forin: true, plusplus: true, maxerr: 50, indent: 4, nomen: true, regexp: true*/
/*globals $, front, gateway, Utilityview */



/**
*   Suppresses console.log
*   @param  {Boolean}   debug   Whether to re-enable console.log or not
*/
function manageDebug(debug) {
    var log, consoleBackUp;
    if (window.console) {
        consoleBackUp = window.console.log;
        window.console.log = function () {
            if (debug) {
                consoleBackUp.apply(console, arguments);
            }
        };
    } else {
        log = window.opera ? window.opera.postError : alert;
        window.console = {};
        window.console.log = function (str) {
            if (debug) {
                log(str);
            }
        };
    }
}

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
    d = d || new Date();
    return d.toLocaleDateString() + ', ' + d.getHours().toString() + ':' + d.getMinutes().toString() + ':' + d.getSeconds().toString();
}

function escapeRegex (str) {
    return str.replace(/[\[\\\^\$\.\|\?\*\+\(\)]/g, '\\$&');
}

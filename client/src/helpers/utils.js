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

function escapeRegex (str) {
    return str.replace(/[\[\\\^\$\.\|\?\*\+\(\)]/g, '\\$&');
}

/**
*   Removes censored words from message
*   @param      {String}    msg The message to format
*   @returns    {String}        The HTML formatted message
*/
function formatCensorMsg(str) {
    var words_in = str.split(' '),
        words_out = [],
        i,
        pattern = /(w?h[oa0][oa0]r|anal|anus|a[$][$]|assfucker|assfucker|assfukka|asshole|assholes|asswhole|b!tch|b00bs|b17ch|b1tch|ballsack|bastard|beastial|beastiality|bestial|bestiality|bi+ch|biatch|bitch|bitchers|bitches|bitching|blowjob|blowjobs|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|bunnyfucker|butthole|buttplug|c0ck|c0cksucker|carpetmuncher|cawk|chink|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|dickhead|dildo|d\!ck|dildos|dogfucker|donkeyribber|doosh|duche|dyke|dike|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|fuck|fucker|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fannyfucker|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fu[\(]k|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudgepacker|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|hardcoresex|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jerk-off|jerkoff|jism|jiz|jizm|jizz|kawk|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3itch|labia|m45terbate|ma5terb8|ma5terbate|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|masturbating|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|motherfucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muthafecker|muthafuckker|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|ni99a|nigger|niggers|negro|negr0|NIGA|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pr0n|pecker|penis|p[.]enis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|pu55sy|rectum|retard|rimjaw|rimming|shit|schlong|scroat|scrote|scrotum|semen|sex|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|s_h_i_t|t1tt1e5|t1tties|testical|testicle|titfuck|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tw4t|twat|twathead|twatty|twunt|twunter|vagina|vag|vulva|w00se|wang|wank|wanker|whoar|whore|hentai|taint|nipple|tits|titties|twat|porn|cock|boob|lesbian|slut|brazzers|xhamster|masturbate|whore|pornstar|threesome|orgy|fuckin|fuck|bitch|bitches|anal|blow job|bj|testicles|nigga|niqqa|rape|raping|rapist|incest|rapes|virginity|sex|bitching|cawks|b[0o]{2,}bs|dic?k|as+h[o0]le?s|g[o0][o0]k|s[ck]ank|pec?k+er|pe+n[ui1]+s+|vagina|va[1jgi]+na|d[1i]ld[o0]|d[i1y]ke|f[4a@]g|wet\\W*back|r4p|gang\\W*bang|dick+|dDIL DOH|6h4y|FUKIN|FGTS|FUCK+|NYIGGA|facial|bukkake|slut|wants the [d]|wants the [v]|negr0|fkuc|pus+ay+h+|sl\*ts|vaj|nuk+a|but+hole|niglet|ass to mouth|Vajayjay|pen is|finger bang|C U Next Tuesday|buttholee|deepthroat|deek|Dick Juice|sodomiz|ejac|negro|gang bang|incest|faggat|analhoe|niggs|b00bs|eeshole|whore mouth|taint|poon|dick ass|homo|jizz|poussey)/gi,
        pushCensor = function (cns) {
            words_out.push(' <span style="color:#838383;" class="cmsg">'+cns+'</span> ');
        };
        
    for (i = 0; i < words_in.length; i++) {
        switch(words_in[i]) {
            case '::place::':
                pushCensor(' ');
                break;
            default:
                if (pattern.test(words_in[i])) {
                    pushCensor('****'); // what to show instead of the censored word
                } else {
                    words_out.push(words_in[i]);
                }
        }
    }

    return words_out.join(' ');
}

// alternate aproach to emotes. takes user specified input and compares against all images found in a directory
// if matching image found, it shows, if not, nothing happens. assumes :code: is used to denote emotes - modify to whatever suits you
function emoticonFromText(str) {
    var words_in = str.split(' '),
        words_out = [],
        i,
        pattern = /([\s]?([:]+[A-Za-z0-9]+[:]+)[\s]?)/ig,
        pushEmoticon = function (code) {
            code2 = code.replace(/:/g, '');
            code2 = code2.toLowerCase();
            words_out.push(' <img class="emote" src="images/emotes/'+code2+'.png" alt=":'+code2+':" title=":'+code2+':" onerror="this.style.visibility=\'hidden\';" /> ');
        };

    for (i = 0; i < words_in.length; i++) {
        switch(words_in[i]) {
            case ':placeholder:':
                code = words_in[i].replace(/:/g, '');
                code = code.toLowerCase();
                pushEmoticon(code);
                break;
            default:
                if (pattern.test(words_in[i])) {
                    code = words_in[i];
                    pushEmoticon(code);
                } else {
                    words_out.push(words_in[i]);
                }
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

// Simplyfy the translation syntax
function translateText(string_id, params) {
    params = params || '';

    return _kiwi.global.i18n.translate(string_id).fetch(params);
}

/**
 * Simplyfy the text styling syntax
 *
 * Syntax:
 *   %nick:     nickname
 *   %channel:  channel
 *   %ident:    ident
 *   %host:     host
 *   %realname: realname
 *   %text:     translated text
 *   %C[digit]: color
 *   %B:        bold
 *   %I:        italic
 *   %U:        underline
 *   %O:        cancel styles
 **/
function styleText(string_id, params) {
    var style, text;

    //style = formatToIrcMsg(_kiwi.app.text_theme[string_id]);
    style = _kiwi.app.text_theme[string_id];
    style = formatToIrcMsg(style);

    // Expand a member mask into its individual parts (nick, ident, hostname)
    if (params.member) {
        params.nick = params.member.nick || '';
        params.ident = params.member.ident || '';
        params.host = params.member.hostname || '';
        params.prefix = params.member.prefix || '';
    }

    // Do the magic. Use the %shorthand syntax to produce output.
    text = style.replace(/%([A-Z]{2,})/ig, function(match, key) {
        if (typeof params[key] !== 'undefined')
            return params[key];
    });

    return text;
}

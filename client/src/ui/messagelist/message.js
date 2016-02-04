define('ui/messagelist/message', function(require, exports, module) {

    var utils = require('helpers/utils');
    var Application = require('ui/application/');

    module.exports = Backbone.Model.extend({
        initialize: function() {
            this.view = new View({model: this});
        }
    });



    var View = Backbone.View.extend({
        className: 'msg',
        template: _.template('<div class="time"><%- time_string %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div>'),
        
        render: function() {
            this.display = this.generateMessageDisplayObj(this.model.attributes);
            this.display.nick = utils.styleText('message_nick', {nick: this.display.nick, prefix: this.display.nick_prefix || ''});

            this.$el.addClass(this.display.type)
                .addClass(this.display.css_classes);
            this.$el.html(this.template(this.display));

            this.$el.data('message', this.model);
            return this;
        },


        // Let nicks be clickable + colourise within messages
        parseMessageNicks: function(word, colourise) {
            var memberlist, member, nick, nick_re, style = '';

            if (!(memberlist = this.model.memberlist) || !(member = memberlist.getByNick(word))) {
                return;
            }

            nick = member.get('nick');

            if (colourise !== false) {
                // Use the nick from the member object so the style matches the letter casing
                style = this.getNickStyles(nick).asCssString();
            }
            nick_re = new RegExp('(.*)(' + _.escapeRegExp(nick) + ')(.*)', 'i');
            return word.replace(nick_re, function (__, before, nick_in_orig_case, after) {
                return _.escape(before) +
                    '<span class="inline-nick" style="' + style + '; cursor:pointer" data-nick="' + _.escape(nick) + '">' +
                    _.escape(nick_in_orig_case) +
                    '</span>' +
                    _.escape(after);
            });
        },


        // Make channels clickable
        parseMessageChannels: function(word) {
            var re,
                parsed = false,
                network = this.model.network;

            if (!network) {
                return parsed;
            }

            re = new RegExp('(^|\\s)([' + _.escapeRegExp(network.get('channel_prefix')) + '][^ ,\\007]+)', 'g');

            if (!word.match(re)) {
                return parsed;
            }

            parsed = word.replace(re, function (m1, m2) {
                return m2 + '<a class="chan" data-channel="' + _.escape(m1.trim()) + '">' + _.escape(m1.trim()) + '</a>';
            });

            return parsed;
        },


        parseMessageUrls: function(word) {
            var found_a_url = false,
                parsed_url;

            parsed_url = word.replace(/^(([A-Za-z][A-Za-z0-9\-]*\:\/\/)|(www\.))([\w\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF.\-]+)([a-zA-Z]{2,6})(:[0-9]+)?(\/[\w\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF!:.?$'()[\]*,;~+=&%@!\-\/]*)?(#.*)?$/gi, function (url) {
                var nice = url,
                    extra_html = '';

                // Don't allow javascript execution
                if (url.match(/^javascript:/)) {
                    return url;
                }

                found_a_url = true;

                // Add the http if no protoocol was found
                if (url.match(/^www\./)) {
                    url = 'http://' + url;
                }

                // Shorten the displayed URL if it's going to be too long
                if (nice.length > 100) {
                    nice = nice.substr(0, 100) + '...';
                }

                // Get any media HTML if supported
                extra_html = require('ui/mediamessage/').buildHtml(url);

                // Make the link clickable
                return '<a class="link-ext" target="_blank" rel="nofollow" href="' + url.replace(/"/g, '%22') + '">' + _.escape(nice) + '</a>' + extra_html;
            });

            return found_a_url ? parsed_url : false;
        },


        // Generate a css style for a nick
        getNickStyles: (function () {

            // Get a colour from a nick (Method based on IRSSIs nickcolor.pl)
            return function (nick) {
                var nick_lightness, nick_int, rgb;

                // Get the lightness option from the theme. Defaults to 35.
                nick_lightness = (_.find(Application.instance().themes, function (theme) {
                    return theme.name.toLowerCase() === _kiwi.global.settings.get('theme').toLowerCase();
                }) || {}).nick_lightness;

                if (typeof nick_lightness !== 'number') {
                    nick_lightness = 35;
                } else {
                    nick_lightness = Math.max(0, Math.min(100, nick_lightness));
                }

                nick_int = _.reduce(nick.split(''), sumCharCodes, 0);
                rgb = utils.hsl2rgb(nick_int % 256, 70, nick_lightness);

                return {
                    color: '#' + ('000000' + (rgb[2] | (rgb[1] << 8) | (rgb[0] << 16)).toString(16)).substr(-6),
                    asCssString: asCssString
                };
            };

            function toCssProperty(result, item, key) {
                return result + (typeof item === 'string' || typeof item === 'number' ? key + ':' + item + ';' : '');
            }
            function asCssString() {
                return _.reduce(this, toCssProperty, '');
            }
            function sumCharCodes(total, i) {
                return total + i.charCodeAt(0);
            }
        }()),


        // Takes an IRC message object and parses it for displaying
        generateMessageDisplayObj: function(msg) {
            var nick_hex, time_difference,
                message_words,
                sb = this.model.messages,
                network = this.model.network,
                nick,
                regexpStr,
                prev_msg = sb.models[sb.models.length-2],
                hour, pm, am_pm_locale_key;

            // Clone the msg object so we dont modify the original
            msg = _.clone(msg);

            // Defaults
            msg.css_classes = '';
            msg.nick_style = '';
            msg.is_highlight = false;
            msg.time_string = '';

            // Nick + custom highlight detecting
            nick = network ? network.get('nick') : '';
            if (nick && msg.nick.localeCompare(nick) !== 0) {
                // Build a list of all highlights and escape them for regex
                regexpStr = _.chain((_kiwi.global.settings.get('custom_highlights') || '').split(/[\s,]+/))
                    .compact()
                    .concat(nick)
                    .map(_.escapeRegExp)
                    .join('|')
                    .value();

                if (msg.msg.search(new RegExp('(\\b|\\W|^)(' + regexpStr + ')(\\b|\\W|$)', 'i')) > -1) {
                    msg.is_highlight = true;
                    msg.css_classes += ' highlight';
                }
            }

            message_words = msg.msg.split(' ');
            message_words = _.map(message_words, function(word) {
                var parsed_word;

                parsed_word = this.parseMessageUrls(word);
                if (typeof parsed_word === 'string') return parsed_word;

                parsed_word = this.parseMessageChannels(word);
                if (typeof parsed_word === 'string') return parsed_word;

                parsed_word = this.parseMessageNicks(word, (msg.type === 'privmsg'));
                if (typeof parsed_word === 'string') return parsed_word;

                parsed_word = _.escape(word);

                // Replace text emoticons with images
                if (_kiwi.global.settings.get('show_emoticons')) {
                    parsed_word = utils.emoticonFromText(parsed_word);
                }

                return parsed_word;
            }, this);

            msg.unparsed_msg = msg.msg;
            msg.msg = message_words.join(' ');

            // Convert IRC formatting into HTML formatting
            msg.msg = utils.formatIRCMsg(msg.msg);

            // Add some style to the nick
            msg.nick_style = this.getNickStyles(msg.nick).asCssString();

            // Generate a hex string from the nick to be used as a CSS class name
            nick_hex = '';
            if (msg.nick) {
                _.map(msg.nick.split(''), function (char) {
                    nick_hex += char.charCodeAt(0).toString(16);
                });
                msg.css_classes += ' nick_' + nick_hex;
            }

            if (prev_msg) {
                // Time difference between this message and the last (in minutes)
                time_difference = (msg.time.getTime() - prev_msg.attributes.time.getTime())/1000/60;
                if (prev_msg.attributes.nick === msg.nick && time_difference < 1) {
                    msg.css_classes += ' repeated-nick';
                }
            }

            // Build up and add the line
            if (_kiwi.global.settings.get('use_24_hour_timestamps')) {
                msg.time_string = msg.time.getHours().toString().lpad(2, "0") + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0");
            } else {
                hour = msg.time.getHours();
                pm = hour > 11;

                hour = hour % 12;
                if (hour === 0)
                    hour = 12;

                am_pm_locale_key = pm ?
                    'client_views_panel_timestamp_pm' :
                    'client_views_panel_timestamp_am';

                msg.time_string = utils.translateText(am_pm_locale_key, hour + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0"));
            }

            return msg;
        },
    });
});
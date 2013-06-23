_kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "panel messages",

    events: {
        "click .chan": "chanClick",
        'click .media .open': 'mediaClick',
        'mouseenter .msg .nick': 'msgEnter',
        'mouseleave .msg .nick': 'msgLeave'
    },

    initialize: function (options) {
        this.initializePanel(options);
    },

    initializePanel: function (options) {
        this.$el.css('display', 'none');
        options = options || {};

        // Containing element for this panel
        if (options.container) {
            this.$container = $(options.container);
        } else {
            this.$container = $('#kiwi .panels .container1');
        }

        this.$el.appendTo(this.$container);

        this.alert_level = 0;

        this.model.bind('msg', this.newMsg, this);
        this.msg_count = 0;

        this.model.set({"view": this}, {"silent": true});
    },

    render: function () {
        var that = this;

        this.$el.empty();
        _.each(this.model.get('scrollback'), function (msg) {
            that.newMsg(msg);
        });
    },

    newMsg: function (msg) {
        var re, line_msg, $this = this.$el,
            nick_colour_hex, nick_hex, is_highlight, msg_css_classes = '',
            time_difference,
            sb = this.model.get('scrollback'),
            prev_msg = sb[sb.length-2];

        // Nick highlight detecting
        if ((new RegExp('(^|\\W)(' + escapeRegex(_kiwi.app.connections.active_connection.get('nick')) + ')(\\W|$)', 'i')).test(msg.msg)) {
            is_highlight = true;
            msg_css_classes += ' highlight';
        }

        // Escape any HTML that may be in here
        msg.msg =  $('<div />').text(msg.msg).html();

        // Make the channels clickable
        re = new RegExp('(?:^|\\s)([' + escapeRegex(_kiwi.gateway.get('channel_prefix')) + '][^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan" data-channel="' + match.trim() + '">' + match + '</a>';
        });


        // Parse any links found
        msg.msg = msg.msg.replace(/(([A-Za-z][A-Za-z0-9\-]*\:\/\/)|(www\.))([\w.\-]+)([a-zA-Z]{2,6})(:[0-9]+)?(\/[\w#!:.?$'()[\]*,;~+=&%@!\-\/]*)?/gi, function (url) {
            var nice = url,
                extra_html = '';

            // Add the http if no protoocol was found
            if (url.match(/^www\./)) {
                url = 'http://' + url;
            }

            // Shorten the displayed URL if it's going to be too long
            if (nice.length > 100) {
                nice = nice.substr(0, 100) + '...';
            }

            // Get any media HTML if supported
            extra_html = _kiwi.view.MediaMessage.buildHtml(url);

            // Make the link clickable
            return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '</a>' + extra_html;
        });


        // Convert IRC formatting into HTML formatting
        msg.msg = formatIRCMsg(msg.msg);


        // Add some colours to the nick (Method based on IRSSIs nickcolor.pl)
        nick_colour_hex = (function (nick) {
            var nick_int = 0, rgb;

            _.map(nick.split(''), function (i) { nick_int += i.charCodeAt(0); });
            rgb = hsl2rgb(nick_int % 255, 70, 35);
            rgb = rgb[2] | (rgb[1] << 8) | (rgb[0] << 16);

            return '#' + rgb.toString(16);
        })(msg.nick);

        msg.nick_style = 'color:' + nick_colour_hex + ';';

        // Generate a hex string from the nick to be used as a CSS class name
        nick_hex = msg.nick_css_class = '';
        if (msg.nick) {
            _.map(msg.nick.split(''), function (char) {
                nick_hex += char.charCodeAt(0).toString(16);
            });
            msg_css_classes += ' nick_' + nick_hex;
        }

        if (prev_msg) {
            // Time difference between this message and the last (in minutes)
            time_difference = (msg.date.getTime() - prev_msg.date.getTime())/1000/60;
            if (prev_msg.nick === msg.nick && time_difference < 1) {
                msg_css_classes += ' repeated_nick';
            }
        }

        // Build up and add the line
        msg.msg_css_classes = msg_css_classes;
        line_msg = '<div class="msg <%= type %> <%= msg_css_classes %>"><div class="time"><%- time %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
        $this.append(_.template(line_msg, msg));

        // Activity/alerts based on the type of new message
        if (msg.type.match(/^action /)) {
            this.alert('action');

        } else if (is_highlight) {
            _kiwi.app.view.alertWindow('* People are talking!');
            _kiwi.app.view.favicon.newHighlight();
            _kiwi.app.view.playSound('highlight');
            this.alert('highlight');

        } else {
            // If this is the active panel, send an alert out
            if (this.model.isActive()) {
                _kiwi.app.view.alertWindow('* People are talking!');
            }
            this.alert('activity');
        }

        if (this.model.isQuery() && !this.model.isActive()) {
            _kiwi.app.view.alertWindow('* People are talking!');
            _kiwi.app.view.playSound('highlight');
        }

        // Update the activity counters
        (function () {
            // Only inrement the counters if we're not the active panel
            if (this.model.isActive()) return;

            var $act = this.model.tab.find('.activity');
            $act.text((parseInt($act.text(), 10) || 0) + 1);
            if ($act.text() === '0') {
                $act.addClass('zero');
            } else {
                $act.removeClass('zero');
            }
        }).apply(this);

        this.scrollToBottom();

        // Make sure our DOM isn't getting too large (Acts as scrollback)
        this.msg_count++;
        if (this.msg_count > (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250)) {
            $('.msg:first', this.$el).remove();
            this.msg_count--;
        }
    },
    chanClick: function (event) {
        if (event.target) {
            _kiwi.gateway.join(null, $(event.target).data('channel'));
        } else {
            // IE...
            _kiwi.gateway.join(null, $(event.srcElement).data('channel'));
        }
    },

    mediaClick: function (event) {
        var $media = $(event.target).parents('.media');
        var media_message;

        if ($media.data('media')) {
            media_message = $media.data('media');
        } else {
            media_message = new _kiwi.view.MediaMessage({el: $media[0]});

            // Cache this MediaMessage instance for when it's opened again
            $media.data('media', media_message);
        }

        media_message.open();
    },

    // Cursor hovers over a message
    msgEnter: function (event) {
        var nick_class;

        // Find a valid class that this element has
        _.each($(event.currentTarget).parent('.msg').attr('class').split(' '), function (css_class) {
            if (css_class.match(/^nick_[a-z0-9]+/i)) {
                nick_class = css_class;
            }
        });

        // If no class was found..
        if (!nick_class) return;

        $('.'+nick_class).addClass('global_nick_highlight');
    },

    // Cursor leaves message
    msgLeave: function (event) {
        var nick_class;

        // Find a valid class that this element has
        _.each($(event.currentTarget).parent('.msg').attr('class').split(' '), function (css_class) {
            if (css_class.match(/^nick_[a-z0-9]+/i)) {
                nick_class = css_class;
            }
        });

        // If no class was found..
        if (!nick_class) return;

        $('.'+nick_class).removeClass('global_nick_highlight');
    },

    show: function () {
        var $this = this.$el;

        // Hide all other panels and show this one
        this.$container.children('.panel').css('display', 'none');
        $this.css('display', 'block');

        // Show this panels memberlist
        var members = this.model.get("members");
        if (members) {
            $('#kiwi .memberlists').removeClass('disabled');
            members.view.show();
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#kiwi .memberlists').addClass('disabled').children().removeClass('active');
        }

        // Remove any alerts and activity counters for this panel
        this.alert('none');
        this.model.tab.find('.activity').text('0').addClass('zero');

        _kiwi.app.panels.trigger('active', this.model, _kiwi.app.panels().active);
        this.model.trigger('active', this.model);

        _kiwi.app.view.doLayout();

        this.scrollToBottom(true);
    },


    alert: function (level) {
        // No need to highlight if this si the active panel
        if (this.model == _kiwi.app.panels().active) return;

        var types, type_idx;
        types = ['none', 'action', 'activity', 'highlight'];

        // Default alert level
        level = level || 'none';

        // If this alert level does not exist, assume clearing current level
        type_idx = _.indexOf(types, level);
        if (!type_idx) {
            level = 'none';
            type_idx = 0;
        }

        // Only 'upgrade' the alert. Never down (unless clearing)
        if (type_idx !== 0 && type_idx <= this.alert_level) {
            return;
        }

        // Clear any existing levels
        this.model.tab.removeClass(function (i, css) {
            return (css.match(/\balert_\S+/g) || []).join(' ');
        });

        // Add the new level if there is one
        if (level !== 'none') {
            this.model.tab.addClass('alert_' + level);
        }

        this.alert_level = type_idx;
    },


    // Scroll to the bottom of the panel
    scrollToBottom: function (force_down) {
        // If this isn't the active panel, don't scroll
        if (this.model !== _kiwi.app.panels().active) return;

        // Don't scroll down if we're scrolled up the panel a little
        if (force_down || this.$container.scrollTop() + this.$container.height() > this.$el.outerHeight() - 150) {
            this.$container[0].scrollTop = this.$container[0].scrollHeight;
        }
    }
});
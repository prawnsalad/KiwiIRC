define(function (require, exports, module) {

var Panel = require('../views/Panel');
var MediaMessage = require('../views/MediaMessage');
var UserBox = require('../views/UserBox');
var MenuBox = require('../views/MenuBox');

module.exports = Panel.extend({
    events: function(){
        var parent_events = this.constructor.__super__.events;

        if(_.isFunction(parent_events)){
            parent_events = parent_events();
        }
        return _.extend({}, parent_events, {
            'click .msg .nick' : 'nickClick',
            "click .chan": "chanClick",
            'click .media .open': 'mediaClick',
            'mouseenter .msg .nick': 'msgEnter',
            'mouseleave .msg .nick': 'msgLeave'
        });
    },

    initialize: function (options) {
        this.initializePanel(options);

        // Container for all the messages
        this.$messages = $('<div class="messages"></div>');
        this.$el.append(this.$messages);

        this.model.bind('change:topic', this.topic, this);

        if (this.model.get('members')) {
            this.model.get('members').bind('add', function (member) {
                if (member.get('nick') === this.model.collection.network.get('nick')) {
                    this.$el.find('.initial_loader').slideUp(function () {
                        $(this).remove();
                    });
                }
            }, this);
        }

        // Only show the loader if this is a channel (ie. not a query)
        if (this.model.isChannel()) {
            this.$el.append('<div class="initial_loader" style="margin:1em;text-align:center;"> ' + _kiwi.global.i18n.translate('client_views_channel_joining').fetch() + ' <span class="loader"></span></div>');
        }

        this.model.bind('msg', this.newMsg, this);
        this.msg_count = 0;
    },


    render: function () {
        var that = this;

        this.$messages.empty();
        _.each(this.model.get('scrollback'), function (msg) {
            that.newMsg(msg);
        });
    },


    newMsg: function (msg) {
        var re, line_msg,
            nick_colour_hex, nick_hex, is_highlight, msg_css_classes = '',
            time_difference,
            sb = this.model.get('scrollback'),
            prev_msg = sb[sb.length-2],
            network, hour, pm;

        // Nick highlight detecting
        var nick = _kiwi.app.connections.active_connection.get('nick');
        if ((new RegExp('(^|\\W)(' + escapeRegex(nick) + ')(\\W|$)', 'i')).test(msg.msg)) {
            // Do not highlight the user's own input
            if (msg.nick.localeCompare(nick) !== 0) {
                is_highlight = true;
                msg_css_classes += ' highlight';
            }
        }

        // Escape any HTML that may be in here
        msg.msg =  $('<div />').text(msg.msg).html();

        // Make the channels clickable
        if ((network = this.model.get('network'))) {
            re = new RegExp('(^|\\s)([' + escapeRegex(network.get('channel_prefix')) + '][^ ,\\007]+)', 'g');
            msg.msg = msg.msg.replace(re, function (m1, m2) {
                return m2 + '<a class="chan" data-channel="' + _.escape(m1.trim()) + '">' + _.escape(m1.trim()) + '</a>';
            });
        }


        // Parse any links found
        msg.msg = msg.msg.replace(/(([A-Za-z][A-Za-z0-9\-]*\:\/\/)|(www\.))([\w.\-]+)([a-zA-Z]{2,6})(:[0-9]+)?(\/[\w#!:.?$'()[\]*,;~+=&%@!\-\/]*)?/gi, function (url) {
            var nice = url,
                extra_html = '';

            if (url.match(/^javascript:/)) {
                return url;
            }

            // Add the http if no protoocol was found
            if (url.match(/^www\./)) {
                url = 'http://' + url;
            }

            // Shorten the displayed URL if it's going to be too long
            if (nice.length > 100) {
                nice = nice.substr(0, 100) + '...';
            }

            // Get any media HTML if supported
            extra_html = MediaMessage.buildHtml(url);

            // Make the link clickable
            return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '</a>' + extra_html;
        });


        // Convert IRC formatting into HTML formatting
        msg.msg = formatIRCMsg(msg.msg);

        // Replace text emoticons with images
        if (_kiwi.global.settings.get('show_emoticons')) {
            msg.msg = emoticonFromText(msg.msg);
        }

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
            time_difference = (msg.time.getTime() - prev_msg.time.getTime())/1000/60;
            if (prev_msg.nick === msg.nick && time_difference < 1) {
                msg_css_classes += ' repeated_nick';
            }
        }

        // Build up and add the line
        msg.msg_css_classes = msg_css_classes;
        if (_kiwi.global.settings.get('use_24_hour_timestamps')) {
            msg.time_string = msg.time.getHours().toString().lpad(2, "0") + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0");
        } else {
            hour = msg.time.getHours();
            pm = hour > 11;

            hour = hour % 12;
            if (hour === 0)
                hour = 12;

            if (pm) {
                msg.time_string = _kiwi.global.i18n.translate('client_views_panel_timestamp_pm').fetch(hour + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0"));
            } else {
                msg.time_string = _kiwi.global.i18n.translate('client_views_panel_timestamp_am').fetch(hour + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0"));
            }
        }

        _kiwi.global.events.emit('message:display', {panel: this.model, message: msg})
        .done(_.bind(function() {
            // Format the nick to the config defined format
            var display_obj = _.clone(msg);
            display_obj.nick = styleText('message_nick', {nick: msg.nick, prefix: msg.nick_prefix || ''});

            line_msg = '<div class="msg <%= type %> <%= msg_css_classes %>"><div class="time"><%- time_string %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
            this.$messages.append($(_.template(line_msg, display_obj)).data('message', msg));

            // Activity/alerts based on the type of new message
            if (msg.type.match(/^action /)) {
                this.alert('action');

            } else if (is_highlight) {
                _kiwi.app.view.alertWindow('* ' + _kiwi.global.i18n.translate('client_views_panel_activity').fetch());
                _kiwi.app.view.favicon.newHighlight();
                _kiwi.app.view.playSound('highlight');
                _kiwi.app.view.showNotification(this.model.get('name'), msg.msg);
                this.alert('highlight');

            } else {
                // If this is the active panel, send an alert out
                if (this.model.isActive()) {
                    _kiwi.app.view.alertWindow('* ' + _kiwi.global.i18n.translate('client_views_panel_activity').fetch());
                }
                this.alert('activity');
            }

            if (this.model.isQuery() && !this.model.isActive()) {
                _kiwi.app.view.alertWindow('* ' + _kiwi.global.i18n.translate('client_views_panel_activity').fetch());

                // Highlights have already been dealt with above
                if (!is_highlight) {
                    _kiwi.app.view.favicon.newHighlight();
                }

                _kiwi.app.view.showNotification(this.model.get('name'), msg.msg);
                _kiwi.app.view.playSound('highlight');
            }

            // Update the activity counters
            (function () {
                // Only inrement the counters if we're not the active panel
                if (this.model.isActive()) return;

                var $act = this.model.tab.find('.activity'),
                    count_all_activity = _kiwi.global.settings.get('count_all_activity'),
                    exclude_message_types;

                // Set the default config value
                if (typeof count_all_activity === 'undefined') {
                    count_all_activity = false;
                }

                // Do not increment the counter for these message types
                exclude_message_types = [
                    'action join',
                    'action quit',
                    'action part',
                    'action kick',
                    'action nick',
                    'action mode'
                ];

                if (count_all_activity || _.indexOf(exclude_message_types, msg.type) === -1) {
                    $act.text((parseInt($act.text(), 10) || 0) + 1);
                }

                if ($act.text() === '0') {
                    $act.addClass('zero');
                } else {
                    $act.removeClass('zero');
                }
            }).apply(this);

            if(this.model.isActive()) this.scrollToBottom();

            // Make sure our DOM isn't getting too large (Acts as scrollback)
            this.msg_count++;
            if (this.msg_count > (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250)) {
                $('.msg:first', this.$messages).remove();
                this.msg_count--;
            }
        }, this));
    },


    topic: function (topic) {
        if (typeof topic !== 'string' || !topic) {
            topic = this.model.get("topic");
        }

        this.model.addMsg('', styleText('channel_topic', {text: translateText('client_views_channel_topic', [this.model.get('name'), topic]), channel: this.model.get('name')}), 'topic');

        // If this is the active channel then update the topic bar
        if (_kiwi.app.panels().active === this) {
            _kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    },

    // Click on a nickname
    nickClick: function (event) {
        var nick = $(event.currentTarget).parent('.msg').data('message').nick,
            members = this.model.get('members'),
            are_we_an_op = !!members.getByNick(_kiwi.app.connections.active_connection.get('nick')).get('is_op'),
            member, query, userbox, menubox;

        if (members) {
            member = members.getByNick(nick);
            if (member) {
                userbox = new UserBox();
                userbox.setTargets(member, this.model);
                userbox.displayOpItems(are_we_an_op);

                menubox = new MenuBox(member.get('nick') || 'User');
                menubox.addItem('userbox', userbox.$el);
                menubox.showFooter(false);
                menubox.show();

                // Position the userbox + menubox
                (function() {
                    var t = event.pageY,
                        m_bottom = t + menubox.$el.outerHeight(),  // Where the bottom of menu will be
                        memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight();

                    // If the bottom of the userbox is going to be too low.. raise it
                    if (m_bottom > memberlist_bottom){
                        t = memberlist_bottom - menubox.$el.outerHeight();
                    }

                    // Set the new positon
                    menubox.$el.offset({
                        left: event.clientX,
                        top: t
                    });
                }).call(this);
            }
        }
    },


    chanClick: function (event) {
        var target = (event.target) ? $(event.target).data('channel') : $(event.srcElement).data('channel');

        _kiwi.app.connections.active_connection.gateway.join(target);
    },


    mediaClick: function (event) {
        var $media = $(event.target).parents('.media');
        var media_message;

        if ($media.data('media')) {
            media_message = $media.data('media');
        } else {
            media_message = new MediaMessage({el: $media[0]});

            // Cache this MediaMessage instance for when it's opened again
            $media.data('media', media_message);
        }

        media_message.toggle();
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
});
});
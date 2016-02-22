_kiwi.view.Channel = _kiwi.view.Panel.extend({
    events: function(){
        var parent_events = this.constructor.__super__.events;

        if(_.isFunction(parent_events)){
            parent_events = parent_events();
        }
        return _.extend({}, parent_events, {
            'click .msg .nick' : 'nickClick',
            'click .msg .inline-nick' : 'nickClick',
            'contextmenu .msg .nick' : 'nickClick',
            'contextmenu .msg .inline-nick' : 'nickClick',
            'dblclick .msg .nick' : 'nickClick',
            'dblclick .msg .inline-nick' : 'nickClick',
            'click .chan': 'chanClick',
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
        this.model.bind('change:topic_set_by', this.topicSetBy, this);

        if (this.model.get('members')) {
            // When we join the memberlist, we have officially joined the channel
            this.model.get('members').bind('add', function (member) {
                if (member.get('nick') === this.model.collection.network.get('nick')) {
                    this.$el.find('.initial_loader').slideUp(function () {
                        $(this).remove();
                    });
                }
            }, this);

            // Memberlist reset with a new nicklist? Consider we have joined
            this.model.get('members').bind('reset', function(members) {
                if (members.getByNick(this.model.collection.network.get('nick'))) {
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

        // Move our lastSeenMarker to the bottom if moving away from this tab
        this.listenTo(_kiwi.app.panels, 'active', function(new_panel, previous_panel) {
            if (previous_panel === this.model) {
                this.updateLastSeenMarker();
            }
        });

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


    newMsg: function(msg) {

        // Parse the msg object into properties fit for displaying
        msg = this.generateMessageDisplayObj(msg);

        _kiwi.global.events.emit('message:display', {panel: this.model, message: msg})
        .then(_.bind(function() {
            var line_msg;

            // Format the nick to the config defined format
            var display_obj = _.clone(msg);
            display_obj.nick = styleText('message_nick', {nick: msg.nick, prefix: msg.nick_prefix || ''});

            line_msg = '<div class="msg <%= type %> <%= css_classes %>"><div class="time"><%- time_string %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
            this.$messages.append($(_.template(line_msg)(display_obj)).data('message', msg));

            // Activity/alerts based on the type of new message. We only do this if we have
            // an associated network (think: could be a broadcasted channel so alerts are not needed)
            if (this.model.get('network')) {
                if (msg.type.match(/^action /)) {
                    this.alert('action');

                } else if (msg.is_highlight) {
                    _kiwi.app.view.alertWindow('* ' + _kiwi.global.i18n.translate('client_views_panel_activity').fetch());
                    _kiwi.app.view.favicon.newHighlight();
                    _kiwi.app.view.playSound('highlight');
                    _kiwi.app.view.showNotification(this.model.get('name'), msg.unparsed_msg);
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
                    if (!msg.is_highlight) {
                        _kiwi.app.view.favicon.newHighlight();
                    }

                    _kiwi.app.view.showNotification(this.model.get('name'), msg.unparsed_msg);
                    _kiwi.app.view.playSound('highlight');
                }

                // Update the activity counters
                (function () {
                    // Only inrement the counters if we're not the active panel
                    if (this.model.isActive()) return;

                    var count_all_activity = _kiwi.global.settings.get('count_all_activity'),
                        exclude_message_types, new_count;

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
                        new_count = this.model.get('activity_counter') || 0;
                        new_count++;
                        this.model.set('activity_counter', new_count);
                    }

                }).apply(this);
            }

            if(this.model.isActive()) this.scrollToBottom();

            // Make sure our DOM isn't getting too large (Acts as scrollback)
            this.msg_count++;
            if (this.msg_count > (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250)) {
                $('.msg:first', this.$messages).remove();
                this.msg_count--;
            }

        }, this));
    },


    // Let nicks be clickable + colourise within messages
    parseMessageNicks: function(word, colourise) {
        var members, member, nick, nick_re, style = '';

        if (!(members = this.model.get('members')) || !(member = members.getByNick(word))) {
            return;
        }

        nick = member.get('nick');

        if (colourise !== false) {
            // Use the nick from the member object so the style matches the letter casing
            style = this.getNickStyles(nick).asCssString();
        }
        nick_re = new RegExp('(.*)(' + _.escapeRegExp(nick) + ')(.*)', 'i');
        return word.replace(nick_re, function (__, before, nick_in_orig_case, after) {
            return _.escape(before)
                + '<span class="inline-nick" style="' + style + '; cursor:pointer" data-nick="' + _.escape(nick) + '">'
                + _.escape(nick_in_orig_case)
                + '</span>'
                + _.escape(after);
        });
    },


    // Make channels clickable
    parseMessageChannels: function(word) {
        var re,
            parsed = false,
            network = this.model.get('network');

        if (!network) {
            return;
        }

        re = new RegExp('(^|\\s)([' + _.escapeRegExp(network.get('channel_prefix')) + '][^ .,\\007]+)', 'g');

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
            extra_html = _kiwi.view.MediaMessage.buildHtml(url);

            // Make the link clickable
            return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url.replace(/"/g, '%22') + '">' + _.escape(nice) + '</a>' + extra_html;
        });

        return found_a_url ? parsed_url : false;
    },


    // Generate a css style for a nick
    getNickStyles: (function () {

        // Get a colour from a nick (Method based on IRSSIs nickcolor.pl)
        return function (nick) {
            var nick_lightness, nick_int, rgb;

            // Get the lightness option from the theme. Defaults to 35.
            nick_lightness = (_.find(_kiwi.app.themes, function (theme) {
                return theme.name.toLowerCase() === _kiwi.global.settings.get('theme').toLowerCase();
            }) || {}).nick_lightness;

            if (typeof nick_lightness !== 'number') {
                nick_lightness = 35;
            } else {
                nick_lightness = Math.max(0, Math.min(100, nick_lightness));
            }

            nick_int = _.reduce(nick.split(''), sumCharCodes, 0);
            rgb = hsl2rgb(nick_int % 256, 70, nick_lightness);

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
            sb = this.model.get('scrollback'),
            network = this.model.get('network'),
            nick,
            regexpStr,
            prev_msg = sb[sb.length-2],
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
                parsed_word = emoticonFromText(parsed_word);
            }

            return parsed_word;
        }, this);

        msg.unparsed_msg = msg.msg;
        msg.msg = message_words.join(' ');

        // Convert IRC formatting into HTML formatting
        msg.msg = formatIRCMsg(msg.msg);

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
            time_difference = (msg.time.getTime() - prev_msg.time.getTime())/1000/60;
            if (prev_msg.nick === msg.nick && time_difference < 1) {
                msg.css_classes += ' repeated_nick';
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

            msg.time_string = translateText(am_pm_locale_key, hour + ":" + msg.time.getMinutes().toString().lpad(2, "0") + ":" + msg.time.getSeconds().toString().lpad(2, "0"));
        }

        return msg;
    },


    topic: function (topic) {
        if (typeof topic !== 'string' || !topic) {
            topic = this.model.get("topic");
        }

        this.model.addMsg('', styleText('channel_topic', {text: topic, channel: this.model.get('name')}), 'topic');

        // If this is the active channel then update the topic bar
        if (_kiwi.app.panels().active === this.model) {
            _kiwi.app.topicbar.setCurrentTopicFromChannel(this.model);
        }
    },

    topicSetBy: function (topic) {
        // If this is the active channel then update the topic bar
        if (_kiwi.app.panels().active === this.model) {
            _kiwi.app.topicbar.setCurrentTopicFromChannel(this.model);
        }
    },

    // Click on a nickname
    nickClick: function (event) {
        var $target = $(event.currentTarget),
            nick,
            members = this.model.get('members'),
            member;

        event.stopPropagation();

        // Check this current element for a nick before resorting to the main message
        // (eg. inline nicks has the nick on its own element within the message)
        nick = $target.data('nick');
        if (!nick) {
            nick = $target.parent('.msg').data('message').nick;
        }

        // Make sure this nick is still in the channel
        member = members ? members.getByNick(nick) : null;
        if (!member) {
            return;
        }

        _kiwi.global.events.emit('nick:select', {
            target: $target,
            member: member,
            network: this.model.get('network'),
            source: 'message',
            $event: event
        })
        .then(_.bind(this.openUserMenuForNick, this, $target, member));
    },


    updateLastSeenMarker: function() {
        // Remove the previous last seen classes
        this.$(".last_seen").removeClass("last_seen");

        // Mark the last message the user saw
        this.$messages.children().last().addClass("last_seen");
    },


    openUserMenuForNick: function ($target, member) {
        var members = this.model.get('members'),
            network = this.model.get('network'),
            are_we_an_op = network ? !!members.getByNick(network.get('nick')).get('is_op') : false,
            userbox, menubox;

        // Can only do user related functions if we have an associated network
        if (!network) {
            return;
        }

        userbox = new _kiwi.view.UserBox();
        userbox.setTargets(member, this.model);
        userbox.displayOpItems(are_we_an_op);

        menubox = new _kiwi.view.MenuBox(member.get('nick') || 'User');
        menubox.addItem('userbox', userbox.$el);
        menubox.showFooter(false);

        _kiwi.global.events.emit('usermenu:created', {menu: menubox, userbox: userbox, user: member})
        .then(_.bind(function() {
            menubox.show();

            // Position the userbox + menubox
            var target_offset = $target.offset(),
                t = target_offset.top,
                m_bottom = t + menubox.$el.outerHeight(),  // Where the bottom of menu will be
                memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight();

            // If the bottom of the userbox is going to be too low.. raise it
            if (m_bottom > memberlist_bottom){
                t = memberlist_bottom - menubox.$el.outerHeight();
            }

            // Set the new positon
            menubox.$el.offset({
                left: target_offset.left,
                top: t
            });
        }, this))
        .then(null, _.bind(function() {
            userbox = null;

            menu.dispose();
            menu = null;
        }, this));
    },


    chanClick: function (event) {
        var target = (event.target) ? $(event.target).data('channel') : $(event.srcElement).data('channel');

        this.model.get('network').gateway.join(target);
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
    }
});

define('ui/panels/channel_view', function(require, exports, module) {

    var Application = require('ui/application/application');
    var utils = require('helpers/utils');

    module.exports = require('./panel_view').extend({
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
            this.messages = this.model.get('messages');
            this.messages.$el.css({
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            });
            this.$el.append(this.messages.$el);

            this.model.bind('change:topic', this.topic, this);
            this.model.bind('change:topic_set_by', this.topicSetBy, this);

            if (this.model.get('members')) {
                // When we join the memberlist, we have officially joined the channel
                this.model.get('members').bind('add', function (member) {
                    if (member.get('nick') === this.model.collection.network.get('nick')) {
                        this.$el.find('.initial-loader').slideUp(function () {
                            $(this).remove();
                        });
                    }
                }, this);

                // Memberlist reset with a new nicklist? Consider we have joined
                this.model.get('members').bind('reset', function(members) {
                    if (members.getByNick(this.model.collection.network.get('nick'))) {
                        this.$el.find('.initial-loader').slideUp(function () {
                            $(this).remove();
                        });
                    }
                }, this);
            }

            // Only show the loader if this is a channel (ie. not a query)
            if (this.model.isChannel()) {
                this.$el.append('<div class="initial-loader" style="margin:1em;text-align:center;"> ' + utils.translateText('client_views_channel_joining') + ' <span class="loader"></span></div>');
            }

            // Move our lastSeenMarker to the bottom if moving away from this tab
            this.listenTo(Application.instance().panels, 'active', function(new_panel, previous_panel) {
                if (previous_panel === this.model) {
                    this.messages.updateLastSeenMarker();
                }

                if (new_panel === this.model) {
                    this.messages.scrollToBottom();
                }
            });

            //this.model.bind('msg', this.newMsg, this);
            this.listenTo(this.model.get('messages').messages, 'add', this.newMsg);
        },


        render: function () {
            var that = this;
        },


        newMsg: function(message) {
            _kiwi.global.events.emit('message:display', {panel: this.model, message: message})
            .then(_.bind(function() {
                var msg = message.attributes;

                // Activity/alerts based on the type of new message. We only do this if we have
                // an associated network (think: could be a broadcasted channel so alerts are not needed)
                if (this.model.get('network')) {
                    if (msg.type.match(/^action /)) {
                        this.alert('action');

                    } else if (msg.is_highlight) {
                        Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));
                        Application.instance().view.favicon.newHighlight();
                        Application.instance().view.playSound('highlight');
                        Application.instance().view.showNotification(this.model.get('name'), msg.unparsed_msg);
                        this.alert('highlight');

                    } else {
                        // If this is the active panel, send an alert out
                        if (this.model.isActive()) {
                            Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));
                        }
                        this.alert('activity');
                    }

                    if (this.model.isQuery() && !this.model.isActive()) {
                        Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));

                        // Highlights have already been dealt with above
                        if (!msg.is_highlight) {
                            Application.instance().view.favicon.newHighlight();
                        }

                        Application.instance().view.showNotification(this.model.get('name'), msg.unparsed_msg);
                        Application.instance().view.playSound('highlight');
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

                    if(this.model.isActive()) this.messages.scrollToBottom();
                }
            }, this));
        },


        topic: function (topic) {
            if (typeof topic !== 'string' || !topic) {
                topic = this.model.get("topic");
            }

            this.model.addMsg('', utils.styleText('channel_topic', {text: topic, channel: this.model.get('name')}), 'topic');

            // If this is the active channel then update the topic bar
            if (Application.instance().panels().active === this.model) {
                Application.instance().topicbar.setCurrentTopicFromChannel(this.model);
            }
        },

        topicSetBy: function (topic) {
            // If this is the active channel then update the topic bar
            if (Application.instance().panels().active === this.model) {
                Application.instance().topicbar.setCurrentTopicFromChannel(this.model);
            }
        },

        // Click on a nickname
        nickClick: function (event) {
            var $target = $(event.currentTarget),
                message,
                nick,
                members = this.model.get('members'),
                member;

            event.stopPropagation();

            message = $target.parent('.msg').data('message');

            // Check this current element for a nick before resorting to the main message
            // (eg. inline nicks has the nick on its own element within the message)
            nick = $target.data('nick');
            if (!nick) {
                nick = message.get('nick');
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


        openUserMenuForNick: function ($target, member) {
            var members = this.model.get('members'),
                network = this.model.get('network'),
                are_we_an_op = network ? !!members.getByNick(network.get('nick')).get('is_op') : false,
                userbox, menubox;

            // Can only do user related functions if we have an associated network
            if (!network) {
                return;
            }

            userbox = new (require('ui/userbox/userbox'))();
            userbox.setTargets(member, this.model);
            userbox.displayOpItems(are_we_an_op);

            menubox = new (require('ui/menubox/menubox'))(member.get('nick') || 'User');
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
                media_message = new (require('ui/mediamessage/mediamessage'))({el: $media[0]});

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

            $('.'+nick_class).addClass('global-nick-highlight');
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

            $('.'+nick_class).removeClass('global-nick-highlight');
        }
    });
});

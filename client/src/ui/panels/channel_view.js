define('ui/panels/channel_view', function(require, exports, module) {

    var Application = require('ui/application/');
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
                'click .chan': 'chanClick'
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
                this.$el.append('<div class="initial-loader" style="top:40%;text-align:center;position: absolute;z-index: 1;width: 100%;"> ' + utils.translateText('client_views_channel_joining') + ' <span class="loader"></span></div>');
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
            var messagePanelAlerts = require('./message_panel_alerts');
            var event_obj = {
                panel: this.model,
                message: message
            };

            // TODO: This plugin trigger should be in the MessageList so that .preventDefault actually
            //       stops it in time
            _kiwi.global.events.emit('message:display', event_obj)
            .then(function() {
                messagePanelAlerts(event_obj.panel, event_obj.message);
                if(event_obj.panel.isActive()) event_obj.panel.view.messages.scrollToBottom();
            });
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

            userbox = new (require('ui/userbox/'))();
            userbox.setTargets(member, this.model);
            userbox.displayOpItems(are_we_an_op);

            menubox = new (require('ui/menubox/'))(member.get('nick') || 'User');
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
        }
    });
});

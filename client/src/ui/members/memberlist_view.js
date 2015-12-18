define('ui/members/memberlist_view', function(require, exports, module) {

    var Application = require('ui/application/');
    var utils = require('helpers/utils');

    module.exports = Backbone.View.extend({
        tagName: "div",
        events: {
            "click .nick": "nickClick",
            "contextmenu .nick": "nickClick",
            "dblclick .nick": "nickClick",
            "click .channel-info": "channelInfoClick"
        },

        initialize: function (options) {
            this.model.bind('all', this.render, this);
            this.$el.appendTo('#kiwi .memberlists');

            // Holds meta data. User counts, etc
            this.$meta = $('<div class="meta"></div>').appendTo(this.$el);

            // The list for holding the nicks
            this.$list = $('<ul></ul>').appendTo(this.$el);
        },
        render: function () {
            var that = this;

            this.$list.empty();
            this.model.forEach(function (member) {
                member.view.$el.data('member', member);
                that.$list.append(member.view.$el);
            });

            // User count
            if(this.model.channel.isActive()) {
                this.renderMeta();
            }

            return this;
        },

        renderMeta: function() {
            var members_count = this.model.length + ' ' + utils.translateText('client_applets_chanlist_users');
            this.$meta.text(members_count);
        },

        nickClick: function (event) {
            var $target = $(event.currentTarget).parent('li'),
                member = $target.data('member');

            _kiwi.global.events.emit('nick:select', {
                target: $target,
                member: member,
                network: this.model.channel.get('network'),
                source: 'nicklist',
                $event: event
            })
            .then(_.bind(this.openUserMenuForItem, this, $target));
        },


        // Open a user menu for the given userlist item (<li>)
        openUserMenuForItem: function($target) {
            var member = $target.data('member'),
                userbox,
                are_we_an_op = !!this.model.getByNick(Application.instance().connections.active_connection.get('nick')).get('is_op');

            userbox = new (require('ui/userbox/userbox'))();
            userbox.setTargets(member, this.model.channel);
            userbox.displayOpItems(are_we_an_op);

            var menu = new (require('ui/menubox/menubox'))(member.get('nick') || 'User');
            menu.addItem('userbox', userbox.$el);
            menu.showFooter(false);

            _kiwi.global.events.emit('usermenu:created', {menu: menu, userbox: userbox, user: member})
            .then(_.bind(function() {
                menu.show();

                var target_offset = $target.offset(),
                    t = target_offset.top,
                    m_bottom = t + menu.$el.outerHeight(),  // Where the bottom of menu will be
                    memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight(),
                    l = target_offset.left,
                    m_right = l + menu.$el.outerWidth(),  // Where the left of menu will be
                    memberlist_right = this.$el.parent().offset().left + this.$el.parent().outerWidth();

                // If the bottom of the userbox is going to be too low.. raise it
                if (m_bottom > memberlist_bottom){
                    t = memberlist_bottom - menu.$el.outerHeight();
                }

                // If the top of the userbox is going to be too high.. lower it
                if (t < 0){
                    t = 0;
                }

                // If the right of the userbox is going off screen.. bring it in
                if (m_right > memberlist_right){
                    l = memberlist_right - menu.$el.outerWidth();
                }

                // Set the new positon
                menu.$el.offset({
                    left: l,
                    top: t
                });

            }, this))
            .then(null, _.bind(function() {
                userbox = null;

                menu.dispose();
                menu = null;
            }, this));
        },


        channelInfoClick: function(event) {
            new (require('ui/channelinfo/channelinfo'))({channel: this.model.channel});
        },


        show: function () {
            $('#kiwi .memberlists').children().removeClass('active');
            $(this.el).addClass('active');

            this.renderMeta();
        }
    });
});

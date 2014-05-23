_kiwi.view.MemberList = Backbone.View.extend({
    tagName: "ul",
    events: {
        "click .nick": "nickClick",
        "click .channel_info": "channelInfoClick"
    },

    initialize: function (options) {
        this.model.bind('all', this.render, this);
        $(this.el).appendTo('#kiwi .memberlists');
    },
    render: function () {
        var $this = this.$el;
        $this.empty();
        
        this.model.forEach(function (member) {
            member.view.$el.data('member', member);
            $this.append(member.view.$el);
        });
        
        // User count
        if(this.model.channel.cid === _kiwi.app.panels().active.cid) {
            var members_count = this.model.length + ' ' + translateText('client_applets_chanlist_users');

            $('#kiwi .membercount > span.' + this.model.channel.cid).text(members_count);
            $('#kiwi .membercount > span.' + this.model.channel.cid).addClass('active');
        }

        return this;
    },
    nickClick: function (event) {
        var $target = $(event.currentTarget).parent('li'),
            member = $target.data('member'),
            userbox,
            are_we_an_op = !!this.model.getByNick(_kiwi.app.connections.active_connection.get('nick')).get('is_op');

        userbox = new _kiwi.view.UserBox();
        userbox.setTargets(member, this.model.channel);
        userbox.displayOpItems(are_we_an_op);

        var menu = new _kiwi.view.MenuBox(member.get('nick') || 'User');
        menu.addItem('userbox', userbox.$el);
        menu.showFooter(false);
        menu.show();

        // Position the userbox + menubox
        (function() {
            var t = event.pageY,
                m_bottom = t + menu.$el.outerHeight(),  // Where the bottom of menu will be
                memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight(),
                l = event.pageX,
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
        }).call(this);
    },


    channelInfoClick: function(event) {
        new _kiwi.model.ChannelInfo({channel: this.model.channel});
    },


    show: function () {
        $('#kiwi .memberlists').children().removeClass('active');
        $(this.el).addClass('active');

        // User count
        var members_count = this.model.length + ' ' + translateText('client_applets_chanlist_users');
        var members_count_code = '<span class="' + this.model.channel.cid + '">';

        $('#kiwi .membercount').children().removeClass('active');
        // If the span for this panel doesn't exist, create it
        if($('#kiwi .membercount > span.' + this.model.channel.cid).length == 0){
            $(members_count_code).appendTo('#kiwi .membercount');
        }

        $('#kiwi .membercount > span.' + this.model.channel.cid).text(members_count);
        $('#kiwi .membercount > span.' + this.model.channel.cid).addClass('active');
    }
});
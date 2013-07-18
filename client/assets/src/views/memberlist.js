_kiwi.view.MemberList = Backbone.View.extend({
    tagName: "ul",
    events: {
        "click .nick": "nickClick"
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
        return this;
    },
    nickClick: function (event) {
        var $target = $(event.currentTarget).parent('li'),
            member = $target.data('member'),
            userbox;

        userbox = new _kiwi.view.UserBox();
        userbox.member = member;
        userbox.channel = this.model.channel;

        if (!this.model.getByNick(_kiwi.app.connections.active_connection.get('nick')).get('is_op')) {
            userbox.$el.children('.if_op').remove();
        }

        var menu = new _kiwi.view.MenuBox(member.get('nick') || 'User');
        menu.addItem('userbox', userbox.$el);
        menu.show();

        // Position the userbox + menubox
        (function() {
            var t = event.pageY,
                m_bottom = t + menu.$el.outerHeight(),  // Where the bottom of menu will be
                memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight();

            // If the bottom of the userbox is going to be too low.. raise it
            if (m_bottom > memberlist_bottom){
                t = memberlist_bottom - menu.$el.outerHeight();
            }

            // Set the new positon
            menu.$el.offset({
                left: _kiwi.app.view.$el.width() - menu.$el.outerWidth() - 20,
                top: t
            });
        }).call(this);
    },
    show: function () {
        $('#kiwi .memberlists').children().removeClass('active');
        $(this.el).addClass('active');
    }
});
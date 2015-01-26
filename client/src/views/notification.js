_kiwi.view.Notification = Backbone.View.extend({
    className: 'notification',

    events: {
        'click .close': 'close'
    },

    initialize: function(title, content) {
        this.title = title;
        this.content = content;
    },

    render: function() {
        this.$el.html($('#tmpl_notifications').html());
        this.$('h6').text(this.title);

        // HTML string or jquery object
        if (typeof this.content === 'string') {
                this.$('.content').html(this.content);
            } else if (typeof this.content === 'object') {
                this.$('.content').empty().append(this.content);
            }

        return this;
    },

    show: function() {
        var that = this;

        this.render().$el.appendTo(_kiwi.app.view.$el);

        // The element won't have any CSS transitions applied
        // until after a tick + paint.
        _.defer(function() {
            that.$el.addClass('show');
        });
    },

    close: function() {
        this.remove();
    }
});
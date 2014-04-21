_kiwi.view.RightBar = Backbone.View.extend({
    initialize: function() {
        this.keep_hidden = false;
        this.hidden = false;
    },


    hide: function() {
        this.hidden = true;
        this.$el.addClass('disabled');
    },


    show: function() {
        this.hidden = false;

        if (!this.keep_hidden)
            this.$el.removeClass('disabled');
    },


    // Toggle if the rightbar should be shown or not
    toggle: function() {
        this.keep_hidden = !this.keep_hidden;

        if (this.keep_hidden || this.hidden) {
            this.$el.addClass('disabled');
        } else {
            this.$el.removeClass('disabled');
        }
    }
});
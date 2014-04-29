_kiwi.view.RightBar = Backbone.View.extend({
    events: {
        'click .right-bar-toggle': 'onClickToggle',
        'click .right-bar-toggle-inner': 'onClickToggle'
    },

    initialize: function() {
        this.keep_hidden = false;
        this.hidden = this.$el.hasClass('disabled');

        this.updateIcon();
    },


    hide: function() {
        this.hidden = true;
        this.$el.addClass('disabled');

        this.updateIcon();
    },


    show: function() {
        this.hidden = false;

        if (!this.keep_hidden)
            this.$el.removeClass('disabled');

        this.updateIcon();
    },


    // Toggle if the rightbar should be shown or not
    toggle: function() {
        this.keep_hidden = !this.keep_hidden;

        if (this.keep_hidden || this.hidden) {
            this.$el.addClass('disabled');
        } else {
            this.$el.removeClass('disabled');
        }

        this.updateIcon();
    },


    updateIcon: function() {
        var $toggle = this.$('.right-bar-toggle'),
            $icon = $toggle.find('i');

        if (!this.hidden && this.keep_hidden) {
            $toggle.show();
        } else {
            $toggle.hide();
        }

        if (this.keep_hidden) {
            $icon.removeClass('icon-double-angle-right').addClass('icon-user');
        } else {
            $icon.removeClass('icon-user').addClass('icon-double-angle-right');
        }
    },


    onClickToggle: function(event) {
        this.toggle();
        _kiwi.app.view.doLayout();
    }
});
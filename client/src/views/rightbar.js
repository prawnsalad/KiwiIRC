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
    toggle: function(keep_hidden) {
        // Hacky, but we need to ignore the toggle() call from doLayout() as we are overriding it
        if (this.ignore_layout)
            return true;

        if (typeof keep_hidden === 'undefined') {
            this.keep_hidden = !this.keep_hidden;
        } else {
            this.keep_hidden = keep_hidden;
        }

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
            $icon.removeClass('fa fa-angle-double-right').addClass('fa fa-user');
        } else {
            $icon.removeClass('fa fa-user').addClass('fa fa-angle-double-right');
        }
    },


    onClickToggle: function(event) {
        this.toggle();

        // Hacky, but we need to ignore the toggle() call from doLayout() as we are overriding it
        this.ignore_layout = true;
        _kiwi.app.view.doLayout();

        // No longer ignoring the toggle() call from doLayout()
        delete this.ignore_layout;
    }
});
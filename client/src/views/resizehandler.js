_melon.view.ResizeHandler = Backbone.View.extend({
    events: {
        'mousedown': 'startDrag',
        'mouseup': 'stopDrag'
    },

    initialize: function () {
        this.dragging = false;
        this.starting_width = {};

        $(window).on('mousemove', $.proxy(this.onDrag, this));
    },

    startDrag: function (event) {
        this.dragging = true;
    },

    stopDrag: function (event) {
        this.dragging = false;
    },

    onDrag: function (event) {
        if (!this.dragging) return;

        var offset = $('#melon').offset().left;

        this.$el.css('left', event.clientX - (this.$el.outerWidth(true) / 2) - offset);
        $('#melon .right_bar').css('width', this.$el.parent().width() - (this.$el.position().left + this.$el.outerWidth()));
        _melon.app.view.doLayout();
    }
});
define('ui/resizehandler/resizehandler', function(require, exports, module) {

    var Application = require('ui/application/');

    module.exports = Backbone.View.extend({
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

            var offset = $('#kiwi').offset().left;

            this.$el.css('left', event.clientX - (this.$el.outerWidth(true) / 2) - offset);
            $('#kiwi .right-bar').css('width', this.$el.parent().width() - (this.$el.position().left + this.$el.outerWidth()));
            Application.instance().view.doLayout();
        }
    });
});

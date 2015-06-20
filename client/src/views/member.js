define('views/member', function(require, exports, module) {
    module.exports = Backbone.View.extend({
        tagName: "li",
        initialize: function (options) {
            this.model.bind('change', this.render, this);
            this.render();
        },
        render: function () {
            var $this = this.$el,
                prefix_css_class = (this.model.get('modes') || []).join(' ');

            $this.attr('class', 'mode ' + prefix_css_class);
            $this.html('<a class="nick"><span class="prefix">' + this.model.get("prefix") + '</span>' + this.model.get("nick") + '</a>');

            return this;
        }
    });
});
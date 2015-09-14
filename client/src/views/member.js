_kiwi.view.Member = Backbone.View.extend({
    tagName: "li",
    initialize: function (options) {
        this.model.bind('change', this.render, this);
        this.render();
    },
    render: function () {
        var $this = this.$el,
            prefix_css_class = (this.model.get('modes') || []).join(' '),
			max_prefix = (this.model.get('modes') || [])[0];

        $this.attr('class', 'mode ' + prefix_css_class + ' member member-' + max_prefix);
        $this.html('<a class="nick"><span class="prefix prefix-' + max_prefix + '">' + this.model.get("prefix") + '</span>' + this.model.get("nick") + '</a>');

        return this;
    }
});
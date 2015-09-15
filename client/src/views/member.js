_kiwi.view.Member = Backbone.View.extend({
    tagName: "li",
    initialize: function (options) {
        this.model.bind('change', this.render, this);
        this.render();
    },
    render: function () {
        var $this = this.$el,
			max_prefix = (this.model.get('modes') || [])[0];
		
		if (!max_prefix) {
			max_prefix = 'none';
		}

        $this.attr('class', 'member member-' + max_prefix);
        $this.html('<a class="nick"><span class="prefix prefix-' + max_prefix + '">' + this.model.get("prefix") + '</span>' + this.model.get("nick") + '</a>');

        return this;
    }
});
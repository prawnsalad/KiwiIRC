_kiwi.view.MenuBox = Backbone.View.extend({
    events: {
        'click .ui_menu_foot .close, a.close_menu': 'dispose'
    },

    initialize: function(title) {
        var that = this;

        this.$el = $('<div class="ui_menu"><div class="items"></div></div>');

        this._title = title || '';
        this._items = {};
        this._display_footer = true;
        this._close_on_blur = true;
    },


    render: function() {
        var that = this,
            $title,
            $items = that.$el.find('.items');

        $items.find('*').remove();

        if (this._title) {
            $title = $('<div class="ui_menu_title"></div>')
                .text(this._title);

            this.$el.prepend($title);
        }

        _.each(this._items, function(item) {
            var $item = $('<div class="ui_menu_content hover"></div>')
                .append(item);

            $items.append($item);
        });

        if (this._display_footer)
            this.$el.append('<div class="ui_menu_foot"><a class="close" onclick="">Close <i class="fa fa-times"></i></a></div>');

    },


    setTitle: function(new_title) {
        this._title = new_title;

        if (!this._title)
            return;

        this.$el.find('.ui_menu_title').text(this._title);
    },


    onDocumentClick: function(event) {
        var $target = $(event.target);

        if (!this._close_on_blur)
            return;

        // If this is not itself AND we don't contain this element, dispose $el
        if ($target[0] != this.$el[0] && this.$el.has($target).length === 0)
            this.dispose();
    },


    dispose: function() {
        _.each(this._items, function(item) {
            item.dispose && item.dispose();
            item.remove && item.remove();
        });

        this._items = null;
        this.remove();

        if (this._close_proxy)
            $(document).off('click', this._close_proxy);
    },


    addItem: function(item_name, $item) {
        if ($item.is('a')) $item.addClass('fa fa-chevron-right');
        this._items[item_name] = $item;
    },


    removeItem: function(item_name) {
        delete this._items[item_name];
    },


    showFooter: function(show) {
        this._display_footer = show;
    },


    closeOnBlur: function(close_it) {
        this._close_on_blur = close_it;
    },


    show: function() {
        var that = this,
            $controlbox, menu_height;

        this.render();
        this.$el.appendTo(_kiwi.app.view.$el);

        // Ensure the menu doesn't get too tall to overlap the input bar at the bottom
        $controlbox = _kiwi.app.view.$el.find('.controlbox');
        $items = this.$el.find('.items');
        menu_height = this.$el.outerHeight() - $items.outerHeight();

        $items.css({
            'overflow-y': 'auto',
            'max-height': $controlbox.offset().top - this.$el.offset().top - menu_height
        });

        // We add this document click listener on the next javascript tick.
        // If the current tick is handling an existing click event (such as the nicklist click handler),
        // the click event bubbles up and hits the document therefore calling this callback to
        // remove this menubox before it's even shown.
        setTimeout(function() {
            that._close_proxy = function(event) {
                that.onDocumentClick(event);
            };
            $(document).on('click', that._close_proxy);
        }, 0);
    }
});

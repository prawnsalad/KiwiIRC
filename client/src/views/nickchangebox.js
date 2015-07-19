_kiwi.view.NickChangeBox = Backbone.View.extend({
    events: {
        'submit': 'changeNick',
        'click .cancel': 'close'
    },

    initialize: function () {
        var tmp_el = document.createElement('div');
        tmp_el.innerHTML = $('#tmpl_nickchange').html().trim();
        _kiwi.global.i18n.translateDOM(tmp_el);
        this.setElement(tmp_el.removeChild(tmp_el.firstChild));
    },

    render: function () {
        // Add the UI component and give it focus
        _kiwi.app.controlbox.$el.prepend(this.$el);
        this.$el.find('input').focus();

        this.$el.css('bottom', _kiwi.app.controlbox.$el.outerHeight(true));
    },

    close: function () {
        this.$el.remove();
        this.trigger('close');
    },

    changeNick: function (event) {
        event.preventDefault();

        var connection = _kiwi.app.connections.active_connection;
        this.listenTo(connection, 'change:nick', function() {
            this.close();
        });

        connection.gateway.changeNick(this.$('input').val());
    }
});
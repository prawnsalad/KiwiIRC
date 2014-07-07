define(function (require, exports, module) {

module.exports = Backbone.View.extend({
    events: {
        'submit': 'changeNick',
        'click .cancel': 'close'
    },

    initialize: function () {
        var text = {
            new_nick: _kiwi.global.i18n.translate('client_views_nickchangebox_new').fetch(),
            change: _kiwi.global.i18n.translate('client_views_nickchangebox_change').fetch(),
            cancel: _kiwi.global.i18n.translate('client_views_nickchangebox_cancel').fetch()
        };
        this.$el = $(_.template($('#tmpl_nickchange').html().trim(), text));
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
});
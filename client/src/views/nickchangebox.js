define('views/nickchangebox', function(require, exports, module) {

    var Application = require('models/application');
    var utils = require('helpers/utils');

    module.exports = Backbone.View.extend({
        events: {
            'submit': 'changeNick',
            'click .cancel': 'close'
        },

        initialize: function () {
            var text = {
                new_nick: utils.translateText('client_views_nickchangebox_new'),
                change: utils.translateText('client_views_nickchangebox_change'),
                cancel: utils.translateText('client_views_nickchangebox_cancel')
            };
            this.$el = $(_.template($('#tmpl_nickchange').html().trim())(text));
        },

        render: function () {
            // Add the UI component and give it focus
            Application.instance().controlbox.$el.prepend(this.$el);
            this.$el.find('input').focus();

            this.$el.css('bottom', Application.instance().controlbox.$el.outerHeight(true));
        },

        close: function () {
            this.$el.remove();
            this.trigger('close');
        },

        changeNick: function (event) {
            event.preventDefault();

            var connection = Application.instance().connections.active_connection;
            this.listenTo(connection, 'change:nick', function() {
                this.close();
            });

            connection.gateway.changeNick(this.$('input').val());
        }
    });
});
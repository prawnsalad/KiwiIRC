define('ui/statusmessage/', function(require, exports, module) {

    var Application = require('ui/application/');

    module.exports = Backbone.View.extend({
        initialize: function () {
            this.$el.hide();

            // Timer for hiding the message after X seconds
            this.tmr = null;
        },

        text: function (text, opt) {
            // Defaults
            opt = opt || {};
            opt.type = opt.type || '';
            opt.timeout = opt.timeout || 5000;

            this.$el.text(text).addClass(opt.type);
            this.$el.slideDown($.proxy(Application.instance().view.doLayout, Application.instance().view));

            if (opt.timeout) this.doTimeout(opt.timeout);
        },

        html: function (html, opt) {
            // Defaults
            opt = opt || {};
            opt.type = opt.type || '';
            opt.timeout = opt.timeout || 5000;

            this.$el.html(html).addClass(opt.type);
            this.$el.slideDown($.proxy(Application.instance().view.doLayout, Application.instance().view));

            if (opt.timeout) this.doTimeout(opt.timeout);
        },

        hide: function () {
            this.$el.slideUp($.proxy(Application.instance().view.doLayout, Application.instance().view));
        },

        doTimeout: function (length) {
            if (this.tmr) clearTimeout(this.tmr);
            var that = this;
            this.tmr = setTimeout(function () { that.hide(); }, length);
        }
    });
});
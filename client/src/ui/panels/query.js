define('ui/panels/query', function(require, exports, module) {
    module.exports = require('./channel').extend({
        initialize: function (attributes) {
            var name = this.get("name") || "",
                members;

            this.view = new (require('./channel_view'))({"model": this, "name": name});
            this.set({
                "name": name,
                "scrollback": []
            }, {"silent": true});

            _kiwi.global.events.emit('panel:created', {panel: this});
        },

        isChannel: function () {
            return false;
        },

        isQuery: function () {
            return true;
        }
    });
});
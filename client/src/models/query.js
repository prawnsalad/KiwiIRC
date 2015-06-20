define('models/query', function(require, exports, module) {
    module.exports = require('models/channel').extend({
        initialize: function (attributes) {
            var name = this.get("name") || "",
                members;

            this.view = new (require('views/channel'))({"model": this, "name": name});
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
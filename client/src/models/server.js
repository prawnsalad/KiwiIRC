define('models/server', function(require, exports, module) {
    module.exports = require('models/channel').extend({
        initialize: function (attributes) {
            var name = "Server";
            this.view = new (require('views/channel'))({"model": this, "name": name});
            this.set({
                "scrollback": [],
                "name": name
            }, {"silent": true});

            _kiwi.global.events.emit('panel:created', {panel: this});
        },

        isServer: function () {
            return true;
        },

        isChannel: function () {
            return false;
        }
    });
});
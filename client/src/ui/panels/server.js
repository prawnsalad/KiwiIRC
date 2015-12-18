define('ui/panels/server', function(require, exports, module) {
    module.exports = require('./channel').extend({
        initialize: function (attributes) {
            var name = "Server",
                messages = new (require('ui/messagelist/'))({network: this.get('network')});
            
            this.set({
                "messages": messages,
                "name": name
            }, {"silent": true});

            this.view = new (require('./channel_view'))({"model": this, "name": name});
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
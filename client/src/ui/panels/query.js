define('ui/panels/query', function(require, exports, module) {
    module.exports = require('./channel').extend({
        initialize: function (attributes) {
            var name = this.get("name") || "",
                members, messages;

            messages = new (require('ui/messagelist/'))({
                network: this.get('network')   // Enables clicking on channels
            });

            this.set({
                "name": name,
                "messages": messages
            }, {"silent": true});

            this.view = new (require('./channel_view'))({"model": this, "name": name});

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
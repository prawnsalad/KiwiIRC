define(function (require, exports, module) {
module.exports = Backbone.View.extend({
    events: {
        'keydown div': 'process'
    },

    initialize: function () {
        _kiwi.app.panels.bind('active', function (active_panel) {
            // If it's a channel topic, update and make editable
            if (active_panel.isChannel()) {
                this.setCurrentTopic(active_panel.get('topic') || '');
                this.$el.find('div').attr('contentEditable', true);

            } else {
                // Not a channel topic.. clear and make uneditable
                this.$el.find('div').attr('contentEditable', false)
                    .text('');
            }
        }, this);
    },

    process: function (ev) {
        var inp = $(ev.currentTarget),
            inp_val = inp.text();

        // Only allow topic editing if this is a channel panel
        if (!_kiwi.app.panels().active.isChannel()) {
            return false;
        }

        // If hit return key, update the current topic
        if (ev.keyCode === 13) {
            _kiwi.app.connections.active_connection.gateway.topic(_kiwi.app.panels().active.get('name'), inp_val);
            return false;
        }
    },

    setCurrentTopic: function (new_topic) {
        new_topic = new_topic || '';

        // We only want a plain text version
        $('div', this.$el).html(formatIRCMsg(_.escape(new_topic)));
    }
});
});
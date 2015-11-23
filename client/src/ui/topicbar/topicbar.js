// views/topicbar
define('ui/topicbar/topicbar', function(require, exports, module) {

    var Application = require('ui/application/application');
    var utils = require('helpers/utils');

    module.exports = Backbone.View.extend({
        events: {
            'keydown div': 'process'
        },

        initialize: function () {
            Application.instance().panels.bind('active', function (active_panel) {
                // If it's a channel topic, update and make editable
                if (active_panel.isChannel()) {
                    this.setCurrentTopicFromChannel(active_panel);
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
            if (!Application.instance().panels().active.isChannel()) {
                return false;
            }

            // If hit return key, update the current topic
            if (ev.keyCode === 13) {
                Application.instance().connections.active_connection.gateway.topic(Application.instance().panels().active.get('name'), inp_val);
                return false;
            }
        },

        setCurrentTopic: function (new_topic) {
            new_topic = new_topic || '';

            // We only want a plain text version
            $('div', this.$el).html(utils.formatIRCMsg(_.escape(new_topic)));
        },

        setCurrentTopicFromChannel: function(channel) {
            var set_by = channel.get('topic_set_by'),
                set_by_text = '';

            this.setCurrentTopic(channel.get("topic"));

            if (set_by) {
                set_by_text += utils.translateText('client_models_network_topic', [set_by.nick, require('utils/formatdate')(set_by.when)]);
                this.$el.attr('title', set_by_text);
            } else {
                this.$el.attr('title', '');
            }
        }
    });
});
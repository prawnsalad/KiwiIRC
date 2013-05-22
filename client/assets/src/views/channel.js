_kiwi.view.Channel = _kiwi.view.Panel.extend({
    initialize: function (options) {
        this.initializePanel(options);
        this.model.bind('change:topic', this.topic, this);

        // Only show the loader if this is a channel (ie. not a query)
        if (this.model.isChannel()) {
            this.$el.append('<div class="initial_loader" style="margin:1em;text-align:center;">Joining channel.. <span class="loader"></span></div>');
        }
    },

    // Override the existing newMsg() method to remove the joining channel loader
    newMsg: function () {
        this.$el.find('.initial_loader').slideUp(function () {
            $(this).remove();
        });

        return this.constructor.__super__.newMsg.apply(this, arguments);
    },

    topic: function (topic) {
        if (typeof topic !== 'string' || !topic) {
            topic = this.model.get("topic");
        }

        this.model.addMsg('', '== Topic for ' + this.model.get('name') + ' is: ' + topic, 'topic');

        // If this is the active channel then update the topic bar
        if (_kiwi.app.panels().active === this) {
            _kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    }
});
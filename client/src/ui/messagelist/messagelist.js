define('ui/messagelist/messagelist', function(require, exports, module) {

	var Message = require('./message');


	var Messages = Backbone.Collection.extend({
		model: Message,
		comparator: 'date',

		initialize: function() {
			this.max_size = (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250);

			this.bind('add', function(new_model) {
				// Make sure we don't go over our scrollback size
				if (this.length > this.max_size) {
					this.shift();
				}

				new_model.messages = this;
				new_model.memberlist = this.memberlist;
				new_model.network = this.network;
			}, this);

			// If set, nicks become clickable
			this.memberlist = null;

			// If set, channels become clickable
			this.network = null;
		}
	});


	var MessageList = Backbone.View.extend({
		className: 'messages',

		initialize: function(opts) {
			var options = opts || {};

			this.messages = new Messages();
			this.listenTo(this.messages, 'add', function(message) {
				this.$el.append(message.view.render().$el);
			});

			// Passing in a memberlist lets nicks be clickable
			if (options.memberlist) {
				this.messages.memberlist = options.memberlist;
			}

			// Passing in a network lets channels be clickable
			if (options.network) {
				this.messages.network = options.network;
			}
		},

		render: function() {
			this.$el.empty();
			this.messages.forEach(function(message) {
				this.$el.append(message.view.render().$el);
			}, this);

			return this;
		},

		updateLastSeenMarker: function() {
            // Remove the previous last seen classes
            this.$('.last-seen').removeClass('last_seen');

            // Mark the last message the user saw
            this.messages.at(this.messages.length-1).view.$el.addClass('last_seen');
		},

        // Scroll to the bottom of the panel
        scrollToBottom: function (force_down) {
        	var $last = this.$(':last');

        	// No message at all? No need to scroll down
        	if ($last.length === 0) return;

            // Don't scroll down if we're scrolled up the panel a little
            if (force_down || this.$el.scrollTop() + this.$el.height() > ($last.position().top + $last.outerHeight()) - 150) {
                this.el.scrollTop = this.el.scrollHeight;
            }
        }
	});

	module.exports = MessageList;
});
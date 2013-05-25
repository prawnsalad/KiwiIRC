_kiwi.view.Channel = _kiwi.view.Panel.extend({
    events: function(){
        var parent_events = _kiwi.view.Panel.prototype.events;
        
        if(_.isFunction(parent_events)){
            parent_events = parent_events();
        }
        return _.extend({}, parent_events, {
            'click .msg .nick' : 'nickClick'
        });
    },

    initialize: function (options) {
        this.initializePanel(options);
        this.model.bind('change:topic', this.topic, this);

        this.model.get('members').bind('add', function (member) {
            if (member.get('nick') === that.collection.network.get('nick')) {
                this.view.$el.find('.initial_loader').slideUp(function () {
                    $(this).remove();
                });
            }
        }, this);

        // Only show the loader if this is a channel (ie. not a query)
        if (this.model.isChannel()) {
            this.$el.append('<div class="initial_loader" style="margin:1em;text-align:center;">Joining channel.. <span class="loader"></span></div>');
        }
    },

    // Override the existing newMsg() method to remove the joining channel loader
    newMsg: function () {
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
    },

    // Click on a nickname
    nickClick: function (event) {
        var nick = $(event.currentTarget).text(),
            members = this.model.get('members'),
            member, query, userbox, menubox;

        if (members) {
            member = members.getByNick(nick);
            if (member) {
                userbox = new _kiwi.view.UserBox();
                userbox.member = member;
                userbox.channel = this.model;

                if (!member.get('is_op')) {
                    userbox.$el.children('.if_op').remove();
                }
                menubox = new _kiwi.view.MenuBox(member.get('nick') || 'User');
                menubox.addItem('userbox', userbox.$el);
                menubox.show();
                
                // Position the userbox + menubox
                (function() {
                    var t = event.pageY,
                        m_bottom = t + menubox.$el.outerHeight(),  // Where the bottom of menu will be
                        memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight();

                    // If the bottom of the userbox is going to be too low.. raise it
                    if (m_bottom > memberlist_bottom){
                        t = memberlist_bottom - menubox.$el.outerHeight();
                    }

                    // Set the new positon
                    menubox.$el.offset({
                        left: event.clientX,
                        top: t
                    });
                }).call(this);
            }
        }
    }
});

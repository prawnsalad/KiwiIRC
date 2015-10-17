(function () {

    var View = Backbone.View.extend({
        events: {
            "click .chan": "chanClick",
            "click .channel_name_title": "sortChannelsByNameClick",
            "click .users_title": "sortChannelsByUsersClick"
        },



        initialize: function (options) {
            var text = {
                channel_name: _melon.global.i18n.translate('client_applets_chanlist_channelname').fetch(),
                users: _melon.global.i18n.translate('client_applets_chanlist_users').fetch(),
                topic: _melon.global.i18n.translate('client_applets_chanlist_topic').fetch()
            };
            this.$el = $(_.template($('#tmpl_channel_list').html().trim(), text));

            this.channels = [];

            // Sort the table
            this.order = '';

            // Waiting to add the table back into the DOM?
            this.waiting = false;
        },

        render: function () {
            var table = $('table', this.$el),
                tbody = table.children('tbody:first').detach(),
                that = this,
                i;

            // Create the sort icon container and clean previous any previous ones
            if($('.applet_chanlist .users_title').find('span.chanlist_sort_users').length == 0) {
                this.$('.users_title').append('<span class="chanlist_sort_users">&nbsp;&nbsp;</span>');
            } else {
                this.$('.users_title span.chanlist_sort_users').removeClass('fa fa-sort-desc');
                this.$('.users_title span.chanlist_sort_users').removeClass('fa fa-sort-asc');
            }
            if ($('.applet_chanlist .channel_name_title').find('span.chanlist_sort_names').length == 0) {
                this.$('.channel_name_title').append('<span class="chanlist_sort_names">&nbsp;&nbsp;</span>');
            } else {
                this.$('.channel_name_title span.chanlist_sort_names').removeClass('fa fa-sort-desc');
                this.$('.channel_name_title span.chanlist_sort_names').removeClass('fa fa-sort-asc');
            }

            // Push the new sort icon
            switch (this.order) {
                case 'user_desc':
                default:
                    this.$('.users_title span.chanlist_sort_users').addClass('fa fa-sort-asc');
                    break;
                case 'user_asc':
                    this.$('.users_title span.chanlist_sort_users').addClass('fa fa-sort-desc');
                    break;
                case 'name_asc':
                    this.$('.channel_name_title span.chanlist_sort_names').addClass('fa fa-sort-desc');
                    break;
                case 'name_desc':
                    this.$('.channel_name_title span.chanlist_sort_names').addClass('fa fa-sort-asc');
                    break;
            }

            this.channels = this.sortChannels(this.channels, this.order);

            // Make sure all the channel DOM nodes are inserted in order
            for (i = 0; i < this.channels.length; i++) {
                tbody[0].appendChild(this.channels[i].dom);
            }

            table[0].appendChild(tbody[0]);
        },


        chanClick: function (event) {
            if (event.target) {
                _melon.gateway.join(null, $(event.target).data('channel'));
            } else {
                // IE...
                _melon.gateway.join(null, $(event.srcElement).data('channel'));
            }
        },

        sortChannelsByNameClick: function (event) {
            // Revert the sorting to switch between orders
            this.order = (this.order == 'name_asc') ? 'name_desc' : 'name_asc';

            this.sortChannelsClick();
        },

        sortChannelsByUsersClick: function (event) {
            // Revert the sorting to switch between orders
            this.order = (this.order == 'user_desc' || this.order == '') ? 'user_asc' : 'user_desc';

            this.sortChannelsClick();
        },

        sortChannelsClick: function() {
            this.render();
        },

        sortChannels: function (channels, order) {
            var sort_channels = [],
                new_channels = [];


            // First we create a light copy of the channels object to do the sorting
            _.each(channels, function (chan, chan_idx) {
                sort_channels.push({'chan_idx': chan_idx, 'num_users': chan.num_users, 'channel': chan.channel});
            });

            // Second, we apply the sorting
            sort_channels.sort(function (a, b) {
                switch (order) {
                    case 'user_asc':
                        return a.num_users - b.num_users;
                    case 'user_desc':
                        return b.num_users - a.num_users;
                    case 'name_asc':
                        if (a.channel.toLowerCase() > b.channel.toLowerCase()) return 1;
                        if (a.channel.toLowerCase() < b.channel.toLowerCase()) return -1;
                    case 'name_desc':
                        if (a.channel.toLowerCase() < b.channel.toLowerCase()) return 1;
                        if (a.channel.toLowerCase() > b.channel.toLowerCase()) return -1;
                    default:
                        return b.num_users - a.num_users;
                }
                return 0;
            });

            // Third, we re-shuffle the chanlist according to the sort order
            _.each(sort_channels, function (chan) {
                new_channels.push(channels[chan.chan_idx]);
            });

            return new_channels;
        }
    });



    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', _melon.global.i18n.translate('client_applets_chanlist_channellist').fetch());
            this.view = new View();

            this.network = _melon.global.components.Network();
            this.network.on('list_channel', this.onListChannel, this);
            this.network.on('list_start', this.onListStart, this);
        },


        // New channels to add to our list
        onListChannel: function (event) {
            this.addChannel(event.chans);
        },

        // A new, fresh channel list starting
        onListStart: function (event) {
            // TODO: clear out our existing list
        },

        addChannel: function (channels) {
            var that = this;

            if (!_.isArray(channels)) {
                channels = [channels];
            }
            _.each(channels, function (chan) {
                var row;
                row = document.createElement("tr");
                row.innerHTML = '<td class="chanlist_name"><a class="chan" data-channel="' + chan.channel + '">' + _.escape(chan.channel) + '</a></td><td class="chanlist_num_users" style="text-align: center;">' + chan.num_users + '</td><td style="padding-left: 2em;" class="chanlist_topic">' + formatIRCMsg(_.escape(chan.topic)) + '</td>';
                chan.dom = row;
                that.view.channels.push(chan);
            });

            if (!that.view.waiting) {
                that.view.waiting = true;
                _.defer(function () {
                    that.view.render();
                    that.view.waiting = false;
                });
            }
        },


        dispose: function () {
            this.view.channels = null;
            this.view.unbind();
            this.view.$el.html('');
            this.view.remove();
            this.view = null;

            // Remove any network event bindings
            this.network.off();
        }
    });



    _melon.model.Applet.register('melon_chanlist', Applet);
})();
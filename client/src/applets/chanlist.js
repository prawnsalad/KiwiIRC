(function () {

    var View = Backbone.View.extend({
        events: {
            "click .chan": "chanClick",
            "click .channel_name_title": "sortChannelsByNameClick",
            "click .users_title": "sortChannelsByUsersClick",
            "click #chan_search": "searchChansClick",
            "click #refresh_chans": "refreshChansClick"
        },



        initialize: function (options) {
            var text = {
                channel_name: _kiwi.global.i18n.translate('client_applets_chanlist_channelname').fetch(),
                users: _kiwi.global.i18n.translate('client_applets_chanlist_users').fetch(),
                topic: _kiwi.global.i18n.translate('client_applets_chanlist_topic').fetch(),
                search_channels: _kiwi.global.i18n.translate('client_applets_chanlist_search_channels').fetch(),
                search: _kiwi.global.i18n.translate('client_applets_chanlist_search').fetch(),
                refresh: _kiwi.global.i18n.translate('client_applets_chanlist_refresh').fetch(),
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
                _kiwi.gateway.join(null, $(event.target).data('channel'));
            } else {
                // IE...
                _kiwi.gateway.join(null, $(event.srcElement).data('channel'));
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
        },

        searchChansClick: function (event) {
            event.preventDefault();

            var table = $('table', this.$el),
                tbody,
                that = this;

            this.text_search = $('#chanlist_search_form input#chan_search_text')[0].value;

            var new_chans = this.searchChans(that.channels);

            // Make sure all the user DOM nodes are inserted in order
            $('.applet_chanlist table tbody:first').remove();
            $('.applet_chanlist table').append('<tbody style="vertical-align: top;"></tbody>');
            tbody = table.children('tbody:first').detach();

            for (i = 0; i < new_chans.length; i++) {
                tbody[0].appendChild(new_chans[i].dom);
            }
            
            // If there is no users, print an info message
            if(new_chans.length == 0) {
                var row = document.createElement("tr");
                row.innerHTML = '<td colspan="3">' + 
                                _kiwi.global.i18n.translate('client_applets_chanlist_noresults').fetch() + 
                                '</td>';
                tbody[0].appendChild(row);
            }

            table[0].appendChild(tbody[0]);
        },

        searchChans: function(channels) {
            var new_chans = [],
                text_search = new RegExp(this.text_search, 'gi');

            // Filter the channels
            _.each(channels, function (channel) {
                var match = false;

                // Split this in two to minimize the workload
                if(text_search.test(channel.channel)) {
                    match = true;
                } else if (text_search.test(channel.topic)) { // This searches in the topic
                    match = true;
                }

                if(match) new_chans.push(channel);
            });
            
            return new_chans;
        },

        refreshChansClick: function(event) {
            event.preventDefault();

            $('#chanlist_search_form input#chan_search_text')[0].value = '';
            
            // Reset the chanlist
            $('.applet_chanlist table tbody:first').remove();
            $('.applet_chanlist table').append('<tbody style="vertical-align: top;"></tbody>');
            this.channels = [];

            // Start the list over again
            kiwi.components.Network().raw('LIST');
        }
    });



    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', _kiwi.global.i18n.translate('client_applets_chanlist_channellist').fetch());
            this.view = new View();

            this.network = _kiwi.global.components.Network();
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



    _kiwi.model.Applet.register('kiwi_chanlist', Applet);
})();
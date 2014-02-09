(function () {

    var View = Backbone.View.extend({
        events: {
            "click .chan": "chanClick",
            "click #channels_name": "sortChannelsByNameClick",
            "click #users": "sortChannelsByUsersClick"
        },

        
        
        initialize: function (options) {
            var text = {
                channel_name: '<a id="channels_name">' + _kiwi.global.i18n.translate('client_applets_chanlist_channelname').fetch() + '</a>',
                users: '<a id="users">' + _kiwi.global.i18n.translate('client_applets_chanlist_users').fetch() + '</a>',
                topic: _kiwi.global.i18n.translate('client_applets_chanlist_topic').fetch()
            };
            this.$el = $(_.template($('#tmpl_channel_list').html().trim(), text));

            this.channels = [];

            // Sort the table
            this.order = '';


            // Waiting to add the table back into the DOM?
            this.waiting = false;
        },

        render: function (override_channels) {
            var table = $('table', this.$el),
                tbody = table.children('tbody:first').detach(),
                that = this,
                channels_length = this.channels.length,
                icon_asc = '<span class="icon-sort-up">&nbsp;&nbsp;</span>',
                icon_desc = '<span class="icon-sort-down">&nbsp;&nbsp;</span>',
                i;
            
            if (override_channels != undefined) {
                that.channels = override_channels;
                tbody.remove();
                this.sorting_channels = true;
            } else {
                that.channels = this.sortChannels(this.channels, this.order);
            }

            // Clean the sorting icon and add the new one
            $('#chanlist #users').find('span').remove();
            $('#chanlist #channels_name').find('span').remove();
            switch (this.order) {
                case 'user_desc':
                default:
                    $('#users').append(icon_desc);
                    break;
                case 'user_asc':
                    $('#users').append(icon_asc);
                    break;
                case 'name_asc':
                    $('#channels_name').append(icon_asc);
                    break;
                case 'name_desc':
                    $('#channels_name').append(icon_desc);
                    break;
            }
            
            tbody.children().each(function (idx, child) {
                if (that.channels[idx].channel === $(child.querySelector('.chan')).data('channel')) {
                    that.channels[idx].dom = tbody[0].removeChild(child);
                }
            });

            for (i = 0; i < channels_length; i++) {
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
            switch (this.order) {
                case '':
                case 'name_desc':
                case 'user_asc':
                case 'user_desc':
                default:
                    this.order = 'name_asc';
                    break;
                case 'name_asc':
                    this.order = 'name_desc';
                    break;
            }
            
            this.sortChannelsClick(this.order);
        },
        
        sortChannelsByUsersClick: function (event) {
            // Revert the sorting to switch between orders
            switch (this.order) {
                case 'user_asc':
                case 'name_asc':
                case 'name_desc':
                default:
                    this.order = 'user_desc';
                    break;
                case '':
                case 'user_desc':
                    this.order = 'user_asc';
                    break;
            }
            
            this.sortChannelsClick(this.order);
        },
        
        sortChannelsClick: function(order) {
            var that = this,
                channels = this.sortChannels(that.channels, order);

            this.render(channels);
        },
        
        sortChannels: function (channels, order) {
            var counter = 0,
                sort_channels = [],
                new_channels = [];
            
            
            // First we create a light copy of the channels object to do the sorting
            _.each(channels, function (chan) {
                sort_channels.push({'counter': counter, 'num_users': chan.num_users, 'channel': chan.channel});
                
                counter += 1;
            });
            
            // Second, we apply the sorting
            sort_channels.sort(function (a, b) {
                switch (order) {
                    case 'user_asc':
                        return a.num_users - b.num_users;
                        break;
                    case 'user_desc':
                        return b.num_users - a.num_users;
                        break;                
                    case 'name_asc':
                        if (a.channel.toLowerCase() > b.channel.toLowerCase()) return 1;
                        if (a.channel.toLowerCase() < b.channel.toLowerCase()) return -1;
                        break;
                    case 'name_desc':
                        if (a.channel.toLowerCase() < b.channel.toLowerCase()) return 1;
                        if (a.channel.toLowerCase() > b.channel.toLowerCase()) return -1;
                        break;
                    default:
                        return b.num_users - a.num_users;
                        break;
                }
                return 0;
            });
            
            // Third, we re-shuffle the chanlist according to the sort order
            _.each(sort_channels, function (chan) {
                new_channels.push(channels[chan.counter]);
            });
            
            return new_channels;
        }
    });



    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', _kiwi.global.i18n.translate('client_applets_chanlist_channellist').fetch());
            this.view = new View();

            this.network = _kiwi.global.components.Network();
            this.network.on('onlist_channel', this.onListChannel, this);
            this.network.on('onlist_start', this.onListStart, this);
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

            // If we're sorting channels, dont rebuild the channel list
            if(this.view.sorting_channels) return;

            if (!_.isArray(channels)) {
                channels = [channels];
            }
            _.each(channels, function (chan) {
                var row;
                row = document.createElement("tr");
                row.innerHTML = '<td><a class="chan" data-channel="' + chan.channel + '">' + _.escape(chan.channel) + '</a></td><td class="num_users" style="text-align: center;">' + chan.num_users + '</td><td style="padding-left: 2em;">' + formatIRCMsg(_.escape(chan.topic)) + '</td>';
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
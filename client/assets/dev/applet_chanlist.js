(function () {

    var View = Backbone.View.extend({
        events: {
        },



        initialize: function (options) {
            this.$el = $($('#tmpl_channel_list').html());

            this.channels = [];

            // Some of this code makes IE go completely crazy, so we have to browser sniff
            // It's horrible, I know, but otherwise a Very Bad Thing™ will happen.
            this.isIE = navigator.appName === 'Microsoft Internet Explorer';

            // Sort the table by num. users?
            this.ordered = !this.isIE;

            // Waiting to add the table back into the DOM?
            this.waiting = false;
        },


        render: function () {
            var table = $('table', this.$el),
                tbody = table.children('tbody:first').detach(),
                that = this;
            if (!this.isIE) {
                tbody.children().each(function (idx, child) {
                    var i, chan,
                        channels_length = that.channels.length;
                    chan = $(child.querySelector('.chan')).data('channel');
                    for (i = 0; i < channels_length; i++) {
                        if (that.channels[i].channel === chan) {
                            that.channels[i].dom = tbody[0].removeChild(child);
                            break;
                        }
                    }
                });
            }

            if (this.ordered) {
                this.channels.sort(function (a, b) {
                    return b.num_users - a.num_users;
                });
            }

            _.each(this.channels, function (chan) {
                tbody[0].appendChild(chan.dom);
            });
            table[0].appendChild(tbody[0]);
        }
    });




    var Applet = Backbone.Model.extend({
        initialize: function () {
            this.set('title', 'Channel List');
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
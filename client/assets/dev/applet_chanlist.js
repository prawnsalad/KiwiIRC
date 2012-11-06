(function () {

    var View = Backbone.View.extend({
        events: {
        },



        initialize: function (options) {
            this.$el = $($('#tmpl_channel_list').html());

            this.channels = [];

            // Sort the table by num. users?
            this.ordered = false;

            // Waiting to add the table back into the DOM?
            this.waiting = false;
        },


        render: function () {
            var table = $('table', this.$el),
                tbody = table.children('tbody:first').detach();
            /*tbody.children().each(function (child) {
                var i, chan;
                child = $(child);
                chan = child.children('td:first').text();
                for (i = 0; i < chanList.length; i++) {
                    if (chanList[i].channel === chan) {
                        chanList[i].html = child.detach();
                        break;
                    }
                }
            });*/

            if (this.ordered) {
                this.channels.sort(function (a, b) {
                    return b.num_users - a.num_users;
                });
            }

            _.each(this.channels, function (chan) {
                tbody.append(chan.html);
            });
            table.append(tbody);
        }
    });




    _kiwi.applets.Chanlist = Backbone.Model.extend({
        initialize: function () {
            this.set('title', 'Channel List');
            this.view = new View();
        },


        addChannel: function (channels) {
            var that = this;

            if (!_.isArray(channels)) {
                channels = [channels];
            }
            _.each(channels, function (chan) {
                var html, channel;
                html = '<tr><td><a class="chan">' + _.escape(chan.channel) + '</a></td><td class="num_users" style="text-align: center;">' + chan.num_users + '</td><td style="padding-left: 2em;">' + formatIRCMsg(_.escape(chan.topic)) + '</td></tr>';
                chan.html = html;
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
        }
    });


})();
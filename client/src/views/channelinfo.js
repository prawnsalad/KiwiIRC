// var f = new _kiwi.model.ChannelInfo({channel: _kiwi.app.panels().active});

_kiwi.view.ChannelInfo = Backbone.View.extend({
    events: {
        'click .toggle_banlist': 'toggleBanList',
        'change .channel-mode': 'onModeChange',
        'click .remove-ban': 'onRemoveBanClick'
    },


    initialize: function () {
        var that = this,
            network,
            channel = this.model.get('channel'),
            text = {
                channel_name: channel.get('name')
            };

        this.$el = $(_.template($('#tmpl_channel_info').html().trim(), text));

        // Create the menu box this view will sit inside
        this.menu = new _kiwi.view.MenuBox(channel.get('name'));
        this.menu.addItem('channel_info', this.$el);
        this.menu.$el.appendTo(channel.view.$container);
        this.menu.show();

        this.menu.$el.offset({top: _kiwi.app.view.$el.find('.panels').offset().top});

        // Menu box will call this destroy on closing
        this.$el.dispose = _.bind(this.dispose, this);

        // Display the info we have, then listen for further changes
        this.updateInfo(channel);
        channel.on('change:info_modes change:info_url change:banlist', this.updateInfo, this);

        // Request the latest info for ths channel from the network
        channel.get('network').gateway.channelInfo(channel.get('name'));
    },


    render: function () {
    },


    onModeChange: function(event) {
        var $this = $(event.currentTarget),
            channel = this.model.get('channel'),
            mode = $this.data('mode'),
            mode_string = '';

        if ($this.attr('type') == 'checkbox') {
            mode_string = $this.is(':checked') ? '+' : '-';
            mode_string += mode;
            channel.setMode(mode_string);

            return;
        }

        if ($this.attr('type') == 'text') {
            mode_string = $this.val() ?
                '+' + mode + ' ' + $this.val() :
                '-' + mode;

            channel.setMode(mode_string);

            return;
        }
    },


    onRemoveBanClick: function (event) {
        event.preventDefault();
        event.stopPropagation();

        var $this = $(event.currentTarget),
            $tr = $this.parents('tr:first'),
            ban = $tr.data('ban');

        if (!ban)
            return;

        var channel = this.model.get('channel');
        channel.setMode('-b ' + ban.banned);

        $tr.remove();
    },


    updateInfo: function (channel, new_val) {
        var that = this,
            title, modes, url, banlist;

        modes = channel.get('info_modes');
        if (modes) {
            _.each(modes, function(mode, idx) {
                mode.mode = mode.mode.toLowerCase();

                if (mode.mode == '+k') {
                    that.$el.find('[name="channel_key"]').val(mode.param);
                } else if (mode.mode == '+m') {
                    that.$el.find('[name="channel_mute"]').attr('checked', 'checked');
                } else if (mode.mode == '+i') {
                    that.$el.find('[name="channel_invite"]').attr('checked', 'checked');
                } else if (mode.mode == '+n') {
                    that.$el.find('[name="channel_external_messages"]').attr('checked', 'checked');
                } else if (mode.mode == '+t') {
                    that.$el.find('[name="channel_topic"]').attr('checked', 'checked');
                }
            });
        }

        url = channel.get('info_url');
        if (url) {
            this.$el.find('.channel_url')
                .text(url)
                .attr('href', url);

            this.$el.find('.channel_url').slideDown();
        }

        banlist = channel.get('banlist');
        if (banlist && banlist.length) {
            this.$el.find('.channel-banlist table').show();
            var $table = this.$el.find('.channel-banlist table tbody');

            this.$el.find('.banlist-status').text('');

            $table.empty();
            _.each(banlist, function(ban) {
                var $tr = $('<tr></tr>').data('ban', ban);

                $('<td></td>').text(ban.banned).appendTo($tr);
                $('<td></td>').text(ban.banned_by.split(/[!@]/)[0]).appendTo($tr);
                $('<td></td>').text(formatDate(new Date(parseInt(ban.banned_at, 10) * 1000))).appendTo($tr);
                $('<td><i class="icon-remove remove-ban"></i></td>').appendTo($tr);

                $table.append($tr);
            });

            this.$el.find('.channel-banlist table').slideDown();
        } else {
            this.$el.find('.banlist-status').text('Banlist empty');
            this.$el.find('.channel-banlist table').hide();
        }
    },

    toggleBanList: function (event) {
        event.preventDefault();
        this.$el.find('.channel-banlist table').toggle();
        var channel = this.model.get('channel'),
        network = channel.get('network');

        network.gateway.raw('MODE ' + channel.get('name') + ' +b');
    },

    dispose: function () {
        this.model.get('channel').off('change:info_modes change:info_url change:banlist', this.updateInfo, this);

        this.$el.remove();
    }
});

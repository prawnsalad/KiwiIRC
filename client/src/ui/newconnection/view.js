define('ui/newconnection/view', function(require, exports, module) {

    var Application = require('ui/application/application');
    var utils = require('helpers/utils');

    module.exports = Backbone.View.extend({
        events: {
            'submit form': 'submitForm',
            'click .show-more': 'showMore',
            'change .have-pass input': 'showPass',
            'change .have-key input': 'showKey',
            'click .fa-key': 'channelKeyIconClick',
            'click .show-server': 'showServer'
        },

        initialize: function () {
            var that = this,
                text = {
                    think_nick: utils.translateText('client_views_serverselect_form_title'),
                    nickname: utils.translateText('client_views_serverselect_nickname'),
                    have_password: utils.translateText('client_views_serverselect_enable_password'),
                    password: utils.translateText('client_views_serverselect_password'),
                    channel: utils.translateText('client_views_serverselect_channel'),
                    channel_key: utils.translateText('client_views_serverselect_channelkey'),
                    require_key: utils.translateText('client_views_serverselect_channelkey_required'),
                    key: utils.translateText('client_views_serverselect_key'),
                    start: utils.translateText('client_views_serverselect_connection_start'),
                    server_network: utils.translateText('client_views_serverselect_server_and_network'),
                    server: utils.translateText('client_views_serverselect_server'),
                    port: utils.translateText('client_views_serverselect_port'),
                    powered_by: utils.translateText('client_views_serverselect_poweredby')
                };

            this.$el = $(_.template($('#tmpl_server_select').html().trim())(text));

            // Remove the 'more' link if the server has disabled server changing
            if (Application.instance().server_settings && Application.instance().server_settings.connection) {
                if (!Application.instance().server_settings.connection.allow_change) {
                    this.$el.find('.show_more').remove();
                    this.$el.addClass('single_server');
                }
            }

            // Are currently showing all the controlls or just a nick_change box?
            this.state = 'all';

            this.more_shown = false;

            this.model.bind('new_network', this.newNetwork, this);

            this.gateway = _kiwi.global.components.Network();
            this.gateway.on('connect', this.networkConnected, this);
            this.gateway.on('connecting', this.networkConnecting, this);
            this.gateway.on('disconnect', this.networkDisconnected, this);
            this.gateway.on('irc_error', this.onIrcError, this);
        },

        dispose: function() {
            this.model.off('new_network', this.newNetwork, this);
            this.gateway.off();

            this.remove();
        },

        submitForm: function (event) {
            event.preventDefault();

            // Make sure a nick is chosen
            if (!$('input.nick', this.$el).val().trim()) {
                this.setStatus(utils.translateText('client_views_serverselect_nickname_error_empty'));
                $('input.nick', this.$el).select();
                return;
            }

            if (this.state === 'nick_change') {
                this.submitNickChange(event);
            } else {
                this.submitLogin(event);
            }

            $('button', this.$el).attr('disabled', 1);
            return;
        },

        submitLogin: function (event) {
            // If submitting is disabled, don't do anything
            if ($('button', this.$el).attr('disabled')) return;

            var values = {
                nick: $('input.nick', this.$el).val(),
                server: $('input.server', this.$el).val(),
                port: $('input.port', this.$el).val(),
                ssl: $('input.ssl', this.$el).prop('checked'),
                password: $('input.password', this.$el).val(),
                channel: $('input.channel', this.$el).val(),
                channel_key: $('input.channel-key', this.$el).val(),
                options: this.server_options
            };

            this.trigger('server_connect', values);
        },

        submitNickChange: function (event) {
            _kiwi.gateway.changeNick(null, $('input.nick', this.$el).val());
            this.networkConnecting();
        },

        showPass: function (event) {
            if (this.$el.find('tr.have-pass input').is(':checked')) {
                this.$el.find('tr.pass').show().find('input').focus();
            } else {
                this.$el.find('tr.pass').hide().find('input').val('');
            }
        },

        channelKeyIconClick: function (event) {
            this.$el.find('tr.have-key input').click();
        },

        showKey: function (event) {
            if (this.$el.find('tr.have-key input').is(':checked')) {
                this.$el.find('tr.key').show().find('input').focus();
            } else {
                this.$el.find('tr.key').hide().find('input').val('');
            }
        },

        showMore: function (event) {
            if (!this.more_shown) {
                $('.more', this.$el).slideDown('fast');
                $('.show_more', this.$el)
                    .children('.fa-caret-down')
                    .removeClass('fa-caret-down')
                    .addClass('fa-caret-up');
                $('input.server', this.$el).select();
                this.more_shown = true;
            } else {
                $('.more', this.$el).slideUp('fast');
                $('.show_more', this.$el)
                    .children('.fs-caret-up')
                    .removeClass('fa-caret-up')
                    .addClass('fa-caret-down');
                $('input.nick', this.$el).select();
                this.more_shown = false;
            }
        },

        populateFields: function (defaults) {
            var nick, server, port, channel, channel_key, ssl, password;

            defaults = defaults || {};

            nick = defaults.nick || '';
            server = defaults.server || '';
            port = defaults.port || 6667;
            ssl = defaults.ssl || 0;
            password = defaults.password || '';
            channel = defaults.channel || '';
            channel_key = defaults.channel_key || '';

            $('input.nick', this.$el).val(nick);
            $('input.server', this.$el).val(server);
            $('input.port', this.$el).val(port);
            $('input.ssl', this.$el).prop('checked', ssl);
            $('input.has_server_pass', this.$el).prop('checked', !(!password));
            $('input.password', this.$el).val(password);
            if (!(!password)) {
                $('tr.pass', this.$el).show();
            }
            $('input.channel', this.$el).val(channel);
            $('input.has-channel-key', this.$el).prop('checked', !(!channel_key));
            $('input.channel-key', this.$el).val(channel_key);
            if (!(!channel_key)) {
                $('tr.key', this.$el).show();
            }

            // Temporary values
            this.server_options = {};

            if (defaults.encoding)
                this.server_options.encoding = defaults.encoding;
        },

        hide: function () {
            this.$el.slideUp();
        },

        show: function (new_state) {
            new_state = new_state || 'all';

            this.$el.show();

            if (new_state === 'all') {
                $('.show_more', this.$el).show();

            } else if (new_state === 'more') {
                $('.more', this.$el).slideDown('fast');

            } else if (new_state === 'nick_change') {
                $('.more', this.$el).hide();
                $('.show_more', this.$el).hide();
                $('input.nick', this.$el).select();

            } else if (new_state === 'enter_password') {
                $('.more', this.$el).hide();
                $('.show_more', this.$el).hide();
                $('input.password', this.$el).select();
            }

            this.state = new_state;
        },

        infoBoxShow: function() {
            var $side_panel = this.$el.find('.side_panel');

            // Some theme may hide the info panel so check before we
            // resize ourselves
            if (!$side_panel.is(':visible'))
                return;

            this.$el.animate({
                width: parseInt($side_panel.css('left'), 10) + $side_panel.find('.content:first').outerWidth()
            });
        },

        infoBoxHide: function() {
            var $side_panel = this.$el.find('.side_panel');
            this.$el.animate({
                width: parseInt($side_panel.css('left'), 10)
            });
        },

        infoBoxSet: function($info_view) {
            this.$el.find('.side_panel .content')
                .empty()
                .append($info_view);
        },

        setStatus: function (text, class_name) {
            $('.status', this.$el)
                .text(text)
                .attr('class', 'status')
                .addClass(class_name||'')
                .show();
        },
        clearStatus: function () {
            $('.status', this.$el).hide();
        },

        reset: function() {
            this.populateFields();
            this.clearStatus();

            this.$('button').attr('disabled', null);
        },

        newNetwork: function(network) {
            // Keep a reference to this network so we can interact with it
            this.model.current_connecting_network = network;
        },

        networkConnected: function (event) {
            this.model.trigger('connected', Application.instance().connections.getByConnectionId(event.server));
            this.model.current_connecting_network = null;
        },

        networkDisconnected: function () {
            this.model.current_connecting_network = null;
            this.state = 'all';
        },

        networkConnecting: function (event) {
            this.model.trigger('connecting');
            this.setStatus(utils.translateText('client_views_serverselect_connection_trying'), 'ok');

            this.$('.status').append('<a class="show-server"><i class="fa fa-info-circle"></i></a>');
        },

        showServer: function() {
            // If we don't have a current connection in the making then we have nothing to show
            if (!this.model.current_connecting_network)
                return;

            Application.instance().view.barsShow();
            this.model.current_connecting_network.panels.server.view.show();
        },

        onIrcError: function (data) {
            $('button', this.$el).attr('disabled', null);

            switch(data.error) {
            case 'nickname_in_use':
                this.setStatus(utils.translateText('client_views_serverselect_nickname_error_alreadyinuse'));
                this.show('nick_change');
                this.$el.find('.nick').select();
                break;
            case 'erroneus_nickname':
                if (data.reason) {
                    this.setStatus(data.reason);
                } else {
                    this.setStatus(utils.translateText('client_views_serverselect_nickname_invalid'));
                }
                this.show('nick_change');
                this.$el.find('.nick').select();
                break;
            case 'password_mismatch':
                this.setStatus(utils.translateText('client_views_serverselect_password_incorrect'));
                this.show('enter_password');
                this.$el.find('.password').select();
                break;
            default:
                this.showError(data.reason || '');
                break;
            }
        },

        showError: function (error_reason) {
            var err_text = utils.translateText('client_views_serverselect_connection_error');

            if (error_reason) {
                switch (error_reason) {
                case 'ENOTFOUND':
                    err_text = utils.translateText('client_views_serverselect_server_notfound');
                    break;

                case 'ECONNREFUSED':
                    err_text += ' (' + utils.translateText('client_views_serverselect_connection_refused') + ')';
                    break;

                default:
                    err_text += ' (' + error_reason + ')';
                }
            }

            this.setStatus(err_text, 'error');
            $('button', this.$el).attr('disabled', null);
            this.show();
        }
    });
});

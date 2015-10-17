_melon.view.UserBox = Backbone.View.extend({
    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick',
        'change .ignore': 'ignoreChange',
        'click .ignore': 'ignoreClick',
        'click .op': 'opClick',
        'click .deop': 'deopClick',
        'click .voice': 'voiceClick',
        'click .devoice': 'devoiceClick',
        'click .kick': 'kickClick',
        'click .ban': 'banClick'
    },

    initialize: function () {
        var text = {
            op: _melon.global.i18n.translate('client_views_userbox_op').fetch(),
            de_op: _melon.global.i18n.translate('client_views_userbox_deop').fetch(),
            voice: _melon.global.i18n.translate('client_views_userbox_voice').fetch(),
            de_voice: _melon.global.i18n.translate('client_views_userbox_devoice').fetch(),
            kick: _melon.global.i18n.translate('client_views_userbox_kick').fetch(),
            ban: _melon.global.i18n.translate('client_views_userbox_ban').fetch(),
            message: _melon.global.i18n.translate('client_views_userbox_query').fetch(),
            info: _melon.global.i18n.translate('client_views_userbox_whois').fetch(),
            ignore: _melon.global.i18n.translate('client_views_userbox_ignore').fetch()
        };
        this.$el = $(_.template($('#tmpl_userbox').html().trim(), text));
    },

    setTargets: function (user, channel) {
        this.user = user;
        this.channel = channel;

        var is_ignored = _melon.app.connections.active_connection.isNickIgnored(this.user.get('nick'));
        this.$('.ignore input').attr('checked', is_ignored ? 'checked' : false);
    },

    displayOpItems: function(display_items) {
        if (display_items) {
            this.$el.find('.if_op').css('display', 'block');
        } else {
            this.$el.find('.if_op').css('display', 'none');
        }
    },

    queryClick: function (event) {
        var nick = this.user.get('nick');
        _melon.app.connections.active_connection.createQuery(nick);
    },

    infoClick: function (event) {
        _melon.app.controlbox.processInput('/whois ' + this.user.get('nick'));
    },

    ignoreClick: function (event) {
        // Stop the menubox from closing since it will not update the checkbox otherwise
        event.stopPropagation();
    },

    ignoreChange: function (event) {
        if ($(event.currentTarget).find('input').is(':checked')) {
            _melon.app.controlbox.processInput('/ignore ' + this.user.get('nick'));
        } else {
            _melon.app.controlbox.processInput('/unignore ' + this.user.get('nick'));
        }
    },

    opClick: function (event) {
        _melon.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +o ' + this.user.get('nick'));
    },

    deopClick: function (event) {
        _melon.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -o ' + this.user.get('nick'));
    },

    voiceClick: function (event) {
        _melon.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +v ' + this.user.get('nick'));
    },

    devoiceClick: function (event) {
        _melon.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -v ' + this.user.get('nick'));
    },

    kickClick: function (event) {
        // TODO: Enable the use of a custom kick message
        _melon.app.controlbox.processInput('/kick ' + this.user.get('nick') + ' Bye!');
    },

    banClick: function (event) {
        // TODO: Set ban on host, not just on nick
        _melon.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +b ' + this.user.get('nick') + '!*');
    }
});
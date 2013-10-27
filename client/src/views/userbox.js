_kiwi.view.UserBox = Backbone.View.extend({
    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick',
        'click .slap': 'slapClick',
        'click .op': 'opClick',
        'click .deop': 'deopClick',
        'click .voice': 'voiceClick',
        'click .devoice': 'devoiceClick',
        'click .kick': 'kickClick',
        'click .ban': 'banClick'
    },

    initialize: function () {
        var text = {
            op: _kiwi.global.i18n.translate('client_views_userbox_op').fetch(),
            de_op: _kiwi.global.i18n.translate('client_views_userbox_deop').fetch(),
            voice: _kiwi.global.i18n.translate('client_views_userbox_voice').fetch(),
            de_voice: _kiwi.global.i18n.translate('client_views_userbox_devoice').fetch(),
            kick: _kiwi.global.i18n.translate('client_views_userbox_kick').fetch(),
            ban: _kiwi.global.i18n.translate('client_views_userbox_ban').fetch(),
            message: _kiwi.global.i18n.translate('client_views_userbox_query').fetch(),
            info: _kiwi.global.i18n.translate('client_views_userbox_whois').fetch(),
            slap: _kiwi.global.i18n.translate('client_views_userbox_slap').fetch()
        };
        this.$el = $(_.template($('#tmpl_userbox').html().trim(), text));
    },

    queryClick: function (event) {
        var panel = new _kiwi.model.Query({name: this.member.get('nick')});
        _kiwi.app.connections.active_connection.panels.add(panel);
        panel.view.show();
    },

    infoClick: function (event) {
        _kiwi.app.controlbox.processInput('/whois ' + this.member.get('nick'));
    },

    slapClick: function (event) {
        _kiwi.app.controlbox.processInput('/slap ' + this.member.get('nick'));
    },

    opClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +o ' + this.member.get('nick'));
    },

    deopClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -o ' + this.member.get('nick'));
    },

    voiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +v ' + this.member.get('nick'));
    },

    devoiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -v ' + this.member.get('nick'));
    },

    kickClick: function (event) {
        // TODO: Enable the use of a custom kick message
        _kiwi.app.controlbox.processInput('/kick ' + this.member.get('nick') + ' Bye!');
    },

    banClick: function (event) {
        // TODO: Set ban on host, not just on nick
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +b ' + this.member.get('nick') + '!*');
    }
});
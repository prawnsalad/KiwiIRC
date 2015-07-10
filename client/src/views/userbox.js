_kiwi.view.UserBox = Backbone.View.extend({
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
        var tmp_el = document.createElement('div');
        tmp_el.innerHTML = $('#tmpl_userbox').html().trim();
        _kiwi.global.i18n.translateDOM(tmp_el);
        this.setElement(tmp_el.removeChild(tmp_el.firstChild));
    },

    setTargets: function (user, channel) {
        this.user = user;
        this.channel = channel;

        var user_mask = toUserMask(this.user.get('nick')),
            is_ignored = _kiwi.app.connections.active_connection.isUserIgnored(user_mask);

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
        _kiwi.app.connections.active_connection.createQuery(nick);
    },

    infoClick: function (event) {
        _kiwi.app.controlbox.processInput('/whois ' + this.user.get('nick'));
    },

    ignoreClick: function (event) {
        // Stop the menubox from closing since it will not update the checkbox otherwise
        event.stopPropagation();
    },

    ignoreChange: function (event) {
        if ($(event.currentTarget).find('input').is(':checked')) {
            _kiwi.app.controlbox.processInput('/ignore ' + this.user.get('nick'));
        } else {
            _kiwi.app.controlbox.processInput('/unignore ' + this.user.get('nick'));
        }
    },

    opClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +o ' + this.user.get('nick'));
    },

    deopClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -o ' + this.user.get('nick'));
    },

    voiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +v ' + this.user.get('nick'));
    },

    devoiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -v ' + this.user.get('nick'));
    },

    kickClick: function (event) {
        // TODO: Enable the use of a custom kick message
        _kiwi.app.controlbox.processInput('/kick ' + this.user.get('nick') + ' Bye!');
    },

    banClick: function (event) {
        // TODO: Set ban on host, not just on nick
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +b ' + this.user.get('nick') + '!*');
    }
});

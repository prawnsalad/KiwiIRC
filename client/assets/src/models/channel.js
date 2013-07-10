// TODO: Channel modes
// TODO: Listen to gateway events for anythign related to this channel
_kiwi.model.Channel = _kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.set({
            "members": new _kiwi.model.MemberList(),
            "name": name,
            "scrollback": [],
            "topic": ""
        }, {"silent": true});

        this.view = new _kiwi.view.Channel({"model": this, "name": name});

        members = this.get("members");
        members.channel = this;
        members.bind("add", function (member) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            if (show_message === false) {
                return;
            }

            this.addMsg(' ', '== ' + _kiwi.global.i18n.translate('client_models_channel_join').fetch(member.displayNick(true)), 'action join');
        }, this);

        members.bind("remove", function (member, members, options) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            var msg = (options.message) ? '(' + options.message + ')' : '';

            if (options.type === 'quit' && show_message) {
                this.addMsg(' ', '== ' + _kiwi.global.i18n.translate('client_models_channel_quit').fetch(member.displayNick(true), msg), 'action quit');

            } else if(options.type === 'kick') {

                if (!options.current_user_kicked) {
                    //If user kicked someone, show the message regardless of settings.
                    if (show_message || options.current_user_initiated) {
                        this.addMsg(' ', '== ' + _kiwi.global.i18n.translate('client_models_channel_kicked').fetch(member.displayNick(true), options.by, msg), 'action kick');
                    }
                } else {
                    this.addMsg(' ', '== ' + _kiwi.global.i18n.translate('client_models_channel_selfkick').fetch(options.by, msg), 'action kick');
                }
            } else if (show_message) {

                this.addMsg(' ', '== ' + _kiwi.global.i18n.translate('client_models_channel_part').fetch(member.displayNick(true), msg), 'action part');
            }
        }, this);
    }
});

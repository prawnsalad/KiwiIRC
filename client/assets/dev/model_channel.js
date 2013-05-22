// TODO: Channel modes
// TODO: Listen to gateway events for anythign related to this channel
_kiwi.model.Channel = _kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members,
            that = this;

        this.view = new _kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "members": new _kiwi.model.MemberList(),
            "name": name,
            "scrollback": [],
            "topic": ""
        }, {"silent": true});

        members = this.get("members");
        members.channel = this;
        members.bind("add", function (member) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            if (show_message === false) {
                return;
            }

            this.addMsg(' ', '== ' + member.displayNick(true) + ' has joined', 'action join');
        }, this);

        members.bind("remove", function (member, members, options) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            if (show_message === false) {
                return;
            }

            var msg = (options.message) ? '(' + options.message + ')' : '';

            if (options.type === 'quit') {
                this.addMsg(' ', '== ' + member.displayNick(true) + ' has quit ' + msg, 'action quit');
            } else if(options.type === 'kick') {
                this.addMsg(' ', '== ' + member.displayNick(true) + ' was kicked by ' + options.by + ' ' + msg, 'action kick');
            } else {
                this.addMsg(' ', '== ' + member.displayNick(true) + ' has left ' + msg, 'action part');
            }
        }, this);
    }
});
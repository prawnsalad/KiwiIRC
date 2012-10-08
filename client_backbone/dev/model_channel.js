// TODO: Channel modes
// TODO: Listen to gateway events for anythign related to this channel
kiwi.model.Channel = kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "",
            members;

        this.view = new kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "members": new kiwi.model.MemberList(),
            "name": name,
            "scrollback": [],
            "topic": ""
        }, {"silent": true});

        members = this.get("members");
        members.bind("add", function (member) {
            this.addMsg(' ', '== ' + member.displayNick(true) + ' has joined', 'action join');
        }, this);

        members.bind("remove", function (member, members, options) {
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
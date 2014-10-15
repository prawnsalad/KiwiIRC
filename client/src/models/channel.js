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
        members.bind("add", function (member, members, options) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            if (show_message === false) {
                return;
            }

            this.addMsg(' ', styleText('channel_join', {member: member.getMaskParts(), text: translateText('client_models_channel_join'), channel: name}), 'action join', {time: options.kiwi.time});
        }, this);

        members.bind("remove", function (member, members, options) {
            var show_message = _kiwi.global.settings.get('show_joins_parts');
            var msg = (options.kiwi.message) ? '(' + options.kiwi.message + ')' : '';

            if (options.kiwi.type === 'quit' && show_message) {
                this.addMsg(' ', styleText('channel_quit', {member: member.getMaskParts(), text: translateText('client_models_channel_quit', [msg]), channel: name}), 'action quit', {time: options.kiwi.time});

            } else if (options.kiwi.type === 'kick') {

                if (!options.kiwi.current_user_kicked) {
                    //If user kicked someone, show the message regardless of settings.
                    if (show_message || options.kiwi.current_user_initiated) {
                        this.addMsg(' ', styleText('channel_kicked', {member: member.getMaskParts(), text: translateText('client_models_channel_kicked', [options.kiwi.by, msg]), channel: name}), 'action kick', {time: options.kiwi.time});
                    }
                } else {
                    this.addMsg(' ', styleText('channel_selfkick', {text: translateText('client_models_channel_selfkick', [options.kiwi.by, msg]), channel: name}), 'action kick', {time: options.kiwi.time});
                }
            } else if (show_message) {
                this.addMsg(' ', styleText('channel_part', {member: member.getMaskParts(), text: translateText('client_models_channel_part', [msg]), channel: name}), 'action part', {time: options.kiwi.time});

            }
        }, this);

        _kiwi.global.events.emit('panel:created', {panel: this});
    },


    addMsg: function (nick, msg, type, opts) {
        var message_obj, bs, d, members, member,
            scrollback = (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250);

        opts = opts || {};

        // Time defaults to now
        if (typeof opts.time === 'number') {
            opts.time = new Date(opts.time);
        } else {
            opts.time = new Date();
        }

        // CSS style defaults to empty string
        if (!opts || typeof opts.style === 'undefined') {
            opts.style = '';
        }

        // Create a message object
        message_obj = {"msg": msg, "date": opts.date, "time": opts.time, "nick": nick, "chan": this.get("name"), "type": type, "style": opts.style};

        // If this user has one, get its prefix
        members = this.get('members');
        if (members) {
            member = members.getByNick(message_obj.nick);
            if (member) {
                message_obj.nick_prefix = member.get('prefix');
            }
        }

        // The CSS class (action, topic, notice, etc)
        if (typeof message_obj.type !== "string") {
            message_obj.type = '';
        }

        // Make sure we don't have NaN or something
        if (typeof message_obj.msg !== "string") {
            message_obj.msg = '';
        }

        // Update the scrollback
        bs = this.get("scrollback");
        if (bs) {
            bs.push(message_obj);

            // Keep the scrolback limited
            if (bs.length > scrollback) {
                bs.splice(scrollback);
            }
            this.set({"scrollback": bs}, {silent: true});
        }

        this.trigger("msg", message_obj);
    },


    clearMessages: function () {
        this.set({'scrollback': []}, {silent: true});
        this.addMsg('', 'Window cleared');

        this.view.render();
    },


    setMode: function(mode_string) {
        this.get('network').gateway.mode(this.get('name'), mode_string);
    },

    isChannel: function() {
        return true;
    }
});

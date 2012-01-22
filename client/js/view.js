/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */

kiwi.view = {};

kiwi.view.MemberList = Backbone.View.extend({
    tagName: "ul",
    events: {
        "click .nick": "nickClick"
    },
    initialize: function (options) {
        $(this.el).attr("id", 'kiwi_userlist_' + options.name);
        this.model.get("members").bind('change', this.render, this);
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.get("members").forEach(function (member) {
            $this.append('<li><a class="nick"><span class="prefix">' + user.prefix + user.nick + '</a></li>');
        });
    },
    nickClick: function (x) {
        console.log(x);
    }
});

kiwi.view.Channel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick"
    },
    initialize: function (options) {
        this.htmlsafe_name = 'chan_' + randomString(15);
        $(this.el).attr("id", 'kiwi_window_' + this.htmlsafe_name);
        this.model.bind('msg', this.newMsg, this);
        this.msg_count = 0;
        this.model.set({"view": this}, {"silent": true});
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.get("backscroll").forEach(this.newMsg);
    },
    newMsg: function (msg) {
        var re, line_msg, $this = $(this.el);
        // Make the channels clickable
        re = new RegExp('\\B(' + kiwi.gateway.channel_prefix + '[^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan">' + match + '</a>';
        });

        msg.msg = kiwi.front.formatIRCMsg(msg.msg);

        // Build up and add the line
        line_msg = $('<div class="msg ' + msg.type + '"><div class="time">' + msg.time + '</div><div class="nick">' + msg.nick + '</div><div class="text" style="' + msg.style + '">' + msg.msg + ' </div></div>');
        $this.append(line_msg);
        this.msg_count++;
        if (this.msg_count > 250) {
            $('.msg:first', this.div).remove();
            this.msg_count--;
        }
    },
    chanClick: function (x) {
        console.log(x);
    }
});

kiwi.view.Tabs = Backbone.View.extend({
    events: {
        "click li": "tabClick"
    },
    initialize: function () {
        this.model.bind("add", this.addTab, this);
        this.model.bind("remove", this.removeTab, this);
        this.model.bind("reset", this.render, this);
    },
    render: function () {
        $this = $(this.el);
        $this.empty();
        this.model.forEach(function (tab) {
            var tabname = $(tab.get("view").el).attr("id");
            $this.append($('<li id="tab_' + tabname + '"><span>' + tab.get("name") + '</span></li>'));
        });
    },
    addTab: function (tab) {
        var tabname = $(tab.get("view").el).attr("id"),
            $this = $(this.el);
        $this.append($('<li id="tab_' + tabname + '"><span>' + tab.get("name") + '</span></li>'));
    },
    removeTab: function (tab) {
        $('#tab_' + $(tab.get("view").el).attr("id")).remove();
    },
    tabClick: function (x) {
        console.log(x);
    }
});












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
        this.model.bind('all', this.render, this);
        $(this.el).appendTo('#kiwi .userlist');
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.forEach(function (member) {
            $('<li><a class="nick"><span class="prefix">' + member.get("prefix") + '</span>' + member.get("nick") + '</a></li>').appendTo($this).data('member', member);
        });
    },
    nickClick: function (x) {
        console.log(x);
    },
    show: function () {
        $('#kiwi .userlist').children().css('display', 'none');
        $(this.el).css('display', 'block');
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
        $(this.el).attr("id", 'kiwi_window_' + this.htmlsafe_name).css('display', 'none');
        this.el = $(this.el).appendTo('#panel1 .scroller')[0];
        this.model.bind('msg', this.newMsg, this);
        this.model.bind('topic', this.topic, this);
        this.msg_count = 0;
        this.model.set({"view": this}, {"silent": true});
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.get("backscroll").forEach(this.newMsg);
    },
    newMsg: function (msg) {
        // TODO: make sure that the message pane is scrolled to the bottom
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
    },
    show: function () {
        $('#panel1 .scroller').children().css('display','none');
        $(this.el).css('display', 'block');
        this.model.get("members").view.show();
        kiwi.front.ui.setTopicText(this.model.get("topic"))
    },
    topic: function (topic) {
        if (!topic) {
            topic = this.model.get("topic");
        }
        this.model.addMsg(null, ' ', '=== Topic for ' + this.model.get("name") + ' is: ' + topic, 'topic');
        if ($(this.el).css('display') === 'block') {
            kiwi.front.ui.setTopicText(this.model.get("topic"))
        }
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
        this.model.server.bind("change", this.render, this);
    },
    render: function () {
        $this = $(this.el);
        $this.empty();
        $('<li id="tab_server"><span>' + kiwi.gateway.network_name + '</span></li>').data('pane', this.model.server).appendTo($this);
        this.model.forEach(function (tab) {
            var tabname = $(tab.get("view").el).attr("id");
            $('<li id="tab_' + tabname + '"><span>' + tab.get("name") + '</span></li>').data('pane', tab).appendTo($this);
        });
    },
    addTab: function (tab) {
        var tabname = $(tab.get("view").el).attr("id"),
            $this = $(this.el);
        $('<li id="tab_' + tabname + '"><span>' + tab.get("name") + '</span></li>').data('pane', tab).appendTo($this);
    },
    removeTab: function (tab) {
        $('#tab_' + $(tab.get("view").el).attr("id")).remove();
    },
    tabClick: function (e) {
        $(e.currentTarget).data('pane').view.show();
    }
});












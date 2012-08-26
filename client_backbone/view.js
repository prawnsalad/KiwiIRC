/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */

kiwi.view = {};

kiwi.view.MemberList = Backbone.View.extend({
    tagName: "ul",
    events: {
        "click .nick": "nickClick"
    },
    initialize: function (options) {
        this.model.bind('all', this.render, this);
        $(this.el).appendTo('#memberlists');
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.forEach(function (member) {
            $('<li><a class="nick"><span class="prefix">' + member.get("prefix") + '</span>' + member.get("nick") + '</a></li>')
                .appendTo($this)
                .data('member', member);
        });
    },
    nickClick: function (x) {
        var target = $(x.currentTarget).parent('li'),
            member = target.data('member'),
            userbox = new kiwi.view.UserBox();
        
        userbox.member = member;
        $('.userbox', this.$el).remove();
        target.append(userbox.$el);
    },
    show: function () {
        $('#memberlists').children().removeClass('active');
        $(this.el).addClass('active');
    }
});


kiwi.view.UserBox = Backbone.View.extend({
    // Member this userbox is relating to
    member: {},

    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick'
    },

    initialize: function () {
        this.$el = $($('#tmpl_userbox').html());
    },

    queryClick: function (event) {
        var panel = new kiwi.model.Channel({name: this.member.get('nick')});
        kiwi.app.panels.add(panel);
        panel.view.show();
    },

    infoClick: function (event) {
        kiwi.gateway.raw('WHOIS ' + this.member.get('nick'));
    }
});


kiwi.view.ServerSelect = Backbone.View.extend({
    that: null,

    events: {
        'submit form': 'submitLogin',
        'click .show_more': 'showMore'
    },

    initialize: function () {
        that = this;

        this.$el = $($('#tmpl_server_select').html());

        kiwi.gateway.on('onconnect', this.networkConnected);
        kiwi.gateway.on('connecting', this.networkConnecting);
    },

    submitLogin: function (event) {
        var values = {
            nick: $('.nick', this.$el).val(),
            server: $('.server', this.$el).val(),
            channel: $('.channel', this.$el).val()
        };

        that.trigger('server_connect', values);
        return false;
    },

    showMore: function (event) {
        $('.more', this.$el).slideDown('fast');
    },

    populateFields: function (defaults) {
        var nick, server, channel;

        defaults = defaults || {};

        nick = defaults.nick || '';
        server = defaults.server || '';
        channel = defaults.channel || '';

        $('.nick', this.$el).val(nick);
        $('.server', this.$el).val(server);
        $('.channel', this.$el).val(channel);
    },

    hide: function () {
        this.$el.slideUp();
    },

    show: function () {
        this.$el.show();
        $('.nick', that.$el).focus();
    },

    setStatus: function (text, class_name) {
        $('.status', this.$el)
            .text(text)
            .attr('class', 'status')
            .addClass(class_name)
            .show();
    },
    clearStatus: function () {
        $('.status', this.$el).hide();
    },

    networkConnected: function (event) {
        that.setStatus('Connected :)', 'ok');
        $('form', this.$el).hide();
    },

    networkConnecting: function (event) {
        that.setStatus('Connecting..', 'ok');
    }
});


kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick"
    },

    // The container this panel is within
    $container: null,

    initialize: function (options) {
        this.initializePanel(options);
    },

    initializePanel: function (options) {
        this.$el.css('display', 'none');

        // Containing element for this panel
        if (options.container) {
            this.$container = $(options.container);
        } else {
            this.$container = $('#panels .container1');
        }

        this.$el.appendTo(this.$container);

        this.model.bind('msg', this.newMsg, this);
        this.msg_count = 0;

        this.model.set({"view": this}, {"silent": true});
    },

    render: function () {
        this.$el.empty();
        this.model.get("backscroll").forEach(this.newMsg);
    },
    newMsg: function (msg) {
        // TODO: make sure that the message pane is scrolled to the bottom (Or do we? ~Darren)
        var re, line_msg, $this = this.$el;

        // Make the channels clickable
        // TODO: HTML parsing may be going into the model.. move this?
        re = new RegExp('\\B(' + kiwi.gateway.channel_prefix + '[^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan">' + match + '</a>';
        });

        // Build up and add the line
        line_msg = '<div class="msg <%= type %>"><div class="time"><%- time %></div><div class="nick"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
        $this.append(_.template(line_msg, msg));

        this.scrollToBottom();

        // Make sure our DOM isn't getting too large (Acts as scrollback)
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
        var $this = this.$el;

        // Hide all other panels and show this one
        this.$container.children().css('display', 'none');
        $this.css('display', 'block');

        // Show this panels memberlist
        var members = this.model.get("members");
        if (members) {
            members.view.show();
            this.$container.parent().css('right', '200px');
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#memberlists').children().removeClass('active');
            this.$container.parent().css('right', '0');
        }

        // TODO: Why is kiwi.app not defined when this is fist called :/
        if (kiwi.app) {
            kiwi.app.setCurrentTopic(this.model.get("topic") || "");
        }

        this.scrollToBottom();

        kiwi.current_panel = this.model;

        this.trigger('active', this.model);
    },


    // Scroll to the bottom of the panel
    scrollToBottom: function () {
        // TODO: Don't scroll down if we're scrolled up the panel a little
        this.$container[0].scrollTop = this.$container[0].scrollHeight;
    }
});

kiwi.view.Channel = kiwi.view.Panel.extend({
    initialize: function (options) {
        this.initializePanel(options);
        this.model.bind('change:topic', this.topic, this);
    },

    topic: function (topic) {
        if (typeof topic !== 'string' || !topic) {
            topic = this.model.get("topic");
        }
        
        this.model.addMsg('', '=== Topic for ' + this.model.get('name') + ' is: ' + topic, 'topic');

        // If this is the active channel then update the topic bar
        if (kiwi.current_panel === this) {
            kiwi.app.setCurrentTopic(this.model.get("topic"));
        }
    }
});

// Model for this = kiwi.model.PanelList
kiwi.view.Tabs = Backbone.View.extend({
    events: {
        "click li": "tabClick",
        'click li img': 'partClick'
    },

    initialize: function () {
        this.model.on("add", this.panelAdded, this);
        this.model.on("remove", this.panelRemoved, this);
        this.model.on("reset", this.render, this);
    },
    render: function () {
        var that = this;
        $this = $(this.el);
        $this.empty();
        
        // Add the server tab first
        $('<li><span>' + kiwi.gateway.get('name') + '</span></li>')
            .data('panel_id', this.model.server.cid)
            .appendTo($this);

        this.model.forEach(function (panel) {
            // If this is the server panel, ignore as it's already added
            if (panel == that.model.server) return;

            $('<li><span>' + panel.get("name") + '</span></li>')
                .data('panel_id', panel.cid)
                .appendTo($this);
        });
    },

    panelAdded: function (panel) {
        // Add a tab to the panel
        panel.tab = $('<li><span>' + panel.get("name") + '</span></li>');
        panel.tab.data('panel_id', panel.cid)
            .appendTo(this.$el);

        panel.view.on('active', this.panelActive, this);
    },
    panelRemoved: function (panel) {
        panel.tab.remove();
        delete panel.tab;
    },

    panelActive: function (panel) {
        // Remove any existing tabs or part images
        $('img', this.$el).remove();
        this.$el.children().removeClass('active');

        panel.tab.addClass('active');
        panel.tab.append('<img src="img/redcross.png" />');
    },

    tabClick: function (e) {
        var panel = this.model.getByCid($(e.currentTarget).data('panel_id'));
        if (!panel) {
            // A panel wasn't found for this tab... wadda fuck
            return;
        }

        panel.view.show();
    },

    partClick: function (e) {
        var panel = this.model.getByCid($(e.currentTarget).parent().data('panel_id'));

        // Only need to part if it's a channel
        if (panel.isChannel()) {
            kiwi.gateway.part(panel.get('name'));
        } else {
            panel.close();
        }
    }
});



kiwi.view.ControlBox = Backbone.View.extend({
    that: this,

    buffer: [],  // Stores previously run commands
    buffer_pos: 0,  // The current position in the buffer

    events: {
        'keydown input': 'process'
    },

    initialize: function () {
        var cb = this; // TODO: Why is `that` not recognised in the below closure?
        that = this;

        kiwi.gateway.bind('change:nick', function () {
            $('.nick', cb.$el).text(this.get('nick'));
        });
    },

    process: function (ev) {
        var inp = $(ev.currentTarget);

        switch (true) {
            case (ev.keyCode === 13):              // return
                this.processInput(inp.val());

                this.buffer.push(inp.val());
                this.buffer_pos = this.buffer.length;

                inp.val('');

                break;

            case (ev.keyCode === 38):              // up
                if (this.buffer_pos > 0) {
                    this.buffer_pos--;
                    inp.val(this.buffer[this.buffer_pos]);
                }
                break;

            case (ev.keyCode === 40):              // down
                if (this.buffer_pos < this.buffer.length) {
                    this.buffer_pos++;
                    inp.val(this.buffer[this.buffer_pos]);
                }
        }
    },


    processInput: function (command_raw) {
        var command,
            params = command_raw.split(' ');
        
        // Extract the command and parameters
        if (params[0][0] === '/') {
            command = params[0].substr(1).toLowerCase();
            params = params.splice(1);
        } else {
            // Default command
            command = 'msg';
            params.unshift(kiwi.current_panel.get('name'));
        }

        // Trigger the command events
        this.trigger('command', {command: command, params: params});
        this.trigger('command_' + command, {command: command, params: params});

        // If we didn't have any listeners for this event, fire a special case
        // TODO: This feels dirty. Should this really be done..?
        if (!this._callbacks['command_' + command]) {
            this.trigger('unknown_command', {command: command, params: params});
        }
    }
});





// This *may* be needed in future
kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        $(window).resize(this.doLayout);
        $('#toolbar').resize(this.doLayout);
        $('#controlbox').resize(this.doLayout);

        this.doLayout();

        $(window).keydown(this.setKeyFocus);
    },


    // Globally shift focus to the command input box on a keypress
    setKeyFocus: function (ev) {
        // If we're copying text, don't shift focus
        if (ev.ctrlKey || ev.altKey) {
            return;
        }

        // If we're typing into an input box somewhere, ignore
        if (ev.srcElement.tagName.toLowerCase() === 'input') {
            return;
        }

        $('#controlbox .inp').focus();
    },


    doLayout: function () {
        var el_panels = $('#panels');
        var el_memberlists = $('#memberlists');
        var el_toolbar = $('#toolbar');
        var el_controlbox = $('#controlbox');

        var css_heights = {
            top: el_toolbar.outerHeight(true),
            bottom: el_controlbox.outerHeight(true)
        };

        el_panels.css(css_heights);
        el_memberlists.css(css_heights);
    },


    barsHide: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideUp();
            $('#controlbox').slideUp(function () { that.doLayout(); });
        } else {
            $('#toolbar').slideUp(0);
            $('#controlbox').slideUp(0);
        }
    },

    barsShow: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideDown();
            $('#controlbox').slideDown(function () { that.doLayout(); });
        } else {
            $('#toolbar').slideDown(0);
            $('#controlbox').slideDown(0);
            this.doLayout();
        }
    }
});
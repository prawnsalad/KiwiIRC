/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */

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

kiwi.view.NickChangeBox = Backbone.View.extend({
    events: {
        'click .btn_nickchange': 'changeNick'
    },
    
    initialize: function () {
        this.$el = $($('#tmpl_nickchange').html());
    },
    
    render: function () {
        $('#controlbox').prepend(this.$el);
        this.$el.css('bottom', $('#controlbox').height());
    },
    
    changeNick: function (event) {;
        var el = this.$el;
        kiwi.gateway.changeNick($('#nickchange', this.$el).val(), function (err, val) {
            el.remove();
        });
    }
});

kiwi.view.ServerSelect = Backbone.View.extend({
    events: {
        'submit form': 'submitLogin',
        'click .show_more': 'showMore'
    },

    initialize: function () {
        this.$el = $($('#tmpl_server_select').html());

        kiwi.gateway.bind('onconnect', this.networkConnected, this);
        kiwi.gateway.bind('connecting', this.networkConnecting, this);
    },

    submitLogin: function (event) {
        var values = {
            nick: $('.nick', this.$el).val(),
            server: $('.server', this.$el).val(),
            port: $('.port', this.$el).val(),
            ssl: $('.ssl', this.$el).prop('checked'),
            password: $('.password', this.$el).val(),
            channel: $('.channel', this.$el).val()
        };

        this.trigger('server_connect', values);
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
        port = defaults.port || 6667;
        ssl = defaults.ssl || 0;
        password = defaults.password || '';
        channel = defaults.channel || '';

        $('.nick', this.$el).val(nick);
        $('.server', this.$el).val(server);
        $('.port', this.$el).val(port);
        $('.ssl', this.$el).prop('checked', ssl);
        $('.password', this.$el).val(password);
        $('.channel', this.$el).val(channel);
    },

    hide: function () {
        this.$el.slideUp();
    },

    show: function () {
        this.$el.show();
        $('.nick', this.$el).focus();
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
        this.setStatus('Connected :)', 'ok');
        $('form', this.$el).hide();
    },

    networkConnecting: function (event) {
        this.setStatus('Connecting..', 'ok');
    },

    showError: function (event) {
        this.setStatus('Error connecting', 'error');
        $('form', this.$el).show();
    }
});


kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick"
    },

    // none=0, action=1, activity=2, highlight=3
    alert_level: 0,

    // The container this panel is within
    $container: null,

    initialize: function (options) {
        this.initializePanel(options);
    },

    initializePanel: function (options) {
        this.$el.css('display', 'none');
        options = options || {};

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
        var re, line_msg, $this = this.$el,
            nick_colour_hex;

        // Escape any HTML that may be in here
        msg.msg =  $('<div />').text(msg.msg).html();

        // Make the channels clickable
        re = new RegExp('\\B([' + kiwi.gateway.get('channel_prefix') + '][^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan">' + match + '</a>';
        });


        // Make links clickable
        msg.msg = msg.msg.replace(/((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]*))?/gi, function (url) {
            var nice;

            // Add the http is no protoocol was found
            if (url.match(/^www\./)) {
                url = 'http://' + url;
            }

            nice = url;
            if (nice.length > 100) {
                nice = nice.substr(0, 100) + '...';
            }

            return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '</a>';
        });


        // Convert IRC formatting into HTML formatting
        msg.msg = formatIRCMsg(msg.msg);


        // Add some colours to the nick (Method based on IRSSIs nickcolor.pl)
        nick_colour_hex = (function (nick) {
            var nick_int = 0, rgb;

            _.map(nick.split(''), function (i) { nick_int += i.charCodeAt(0); });
            rgb = hsl2rgb(nick_int % 255, 70, 35);
            rgb = rgb[2] | (rgb[1] << 8) | (rgb[0] << 16);

            return '#' + rgb.toString(16);
        })(msg.nick);

        msg.nick_style = 'color:' + nick_colour_hex + ';';

        // Build up and add the line
        line_msg = '<div class="msg <%= type %>"><div class="time"><%- time %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
        $this.append(_.template(line_msg, msg));

        if (msg.type === 'action') {
            this.alert('action');
        } else if (msg.msg.indexOf(kiwi.gateway.get('nick')) > -1) {
            this.alert('highlight');
        } else {
            this.alert('activity');
        }

        this.scrollToBottom();

        // Make sure our DOM isn't getting too large (Acts as scrollback)
        this.msg_count++;
        if (this.msg_count > 250) {
            $('.msg:first', this.$el).remove();
            this.msg_count--;
        }
    },
    chanClick: function (x) {
        kiwi.gateway.join($(x.srcElement).text());
    },
    show: function () {
        var $this = this.$el;

        // Hide all other panels and show this one
        this.$container.children().css('display', 'none');
        $this.css('display', 'block');

        // Show this panels memberlist
        var members = this.model.get("members");
        if (members) {
            $('#memberlists').show();
            members.view.show();
            this.$container.parent().css('right', '200px');
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#memberlists').hide().children().removeClass('active');
            this.$container.parent().css('right', '0');
        }

        this.scrollToBottom();
        this.alert('none');

        this.trigger('active', this.model);
        kiwi.app.panels.trigger('active', this.model);
    },


    alert: function (level) {
        // No need to highlight if this si the active panel
        if (this.model == kiwi.app.panels.active) return;

        var types, type_idx;
        types = ['none', 'action', 'activity', 'highlight'];

        // Default alert level
        level = level || 'none';

        // If this alert level does not exist, assume clearing current level
        type_idx = _.indexOf(types, level);
        if (!type_idx) {
            level = 'none';
            type_idx = 0;
        }

        // Only 'upgrade' the alert. Never down (unless clearing)
        console.log(type_idx, this.alert_level);
        if (type_idx !== 0 && type_idx <= this.alert_level) {
            return;
        }

        // Clear any existing levels
        this.model.tab.removeClass(function (i, css) {
            return (css.match(/\balert_\S+/g) || []).join(' ');
        });

        // Add the new level if there is one
        if (level !== 'none') {
            this.model.tab.addClass('alert_' + level);
        }

        this.alert_level = type_idx;
    },


    // Scroll to the bottom of the panel
    scrollToBottom: function () {
        // TODO: Don't scroll down if we're scrolled up the panel a little
        this.$container[0].scrollTop = this.$container[0].scrollHeight;
    }
});

kiwi.view.Applet = kiwi.view.Panel.extend({
    className: 'applet',
    initialize: function (options) {
        this.initializePanel(options);
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
        if (kiwi.app.panels.active === this) {
            kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    }
});

// Model for this = kiwi.model.PanelList
kiwi.view.Tabs = Backbone.View.extend({
    tabs_applets: null,
    tabs_msg: null,

    events: {
        'click li': 'tabClick',
        'click li img': 'partClick'
    },

    initialize: function () {
        this.model.on("add", this.panelAdded, this);
        this.model.on("remove", this.panelRemoved, this);
        this.model.on("reset", this.render, this);

        this.model.on('active', this.panelActive, this);

        this.tabs_applets = $('ul.applets', this.$el);
        this.tabs_msg = $('ul.channels', this.$el);
        window.t = this;

        kiwi.gateway.on('change:name', function (gateway, new_val) {
            $('span', this.model.server.tab).text(new_val);
        }, this);
    },
    render: function () {
        var that = this;

        this.tabs_msg.empty();
        
        // Add the server tab first
        this.model.server.tab
            .data('panel_id', this.model.server.cid)
            .appendTo(this.tabs_msg);

        // Go through each panel adding its tab
        this.model.forEach(function (panel) {
            // If this is the server panel, ignore as it's already added
            if (panel == that.model.server) return;

            panel.tab
                .data('panel_id', panel.cid)
                .appendTo(panel.isApplet() ? this.tabs_applets : this.tabs_msg);
        });

        kiwi.app.view.doLayout();
    },

    updateTabTitle: function (panel, new_title) {
        $('span', panel.tab).text(new_title);
    },

    panelAdded: function (panel) {
        // Add a tab to the panel
        panel.tab = $('<li><span>' + (panel.get('title') || panel.get('name')) + '</span></li>');
        panel.tab.data('panel_id', panel.cid)
            .appendTo(panel.isApplet() ? this.tabs_applets : this.tabs_msg);

        panel.bind('change:title', this.updateTabTitle);
        kiwi.app.view.doLayout();
    },
    panelRemoved: function (panel) {
        panel.tab.remove();
        delete panel.tab;

        kiwi.app.view.doLayout();
    },

    panelActive: function (panel) {
        // Remove any existing tabs or part images
        $('img', this.$el).remove();
        this.tabs_applets.children().removeClass('active');
        this.tabs_msg.children().removeClass('active');

        panel.tab.addClass('active');
        panel.tab.append('<img src="img/redcross.png" />');
    },

    tabClick: function (e) {
        var tab = $(e.currentTarget);

        var panel = this.model.getByCid(tab.data('panel_id'));
        if (!panel) {
            // A panel wasn't found for this tab... wadda fuck
            return;
        }

        panel.view.show();
    },

    partClick: function (e) {
        var tab = $(e.currentTarget).parent();
        var panel = this.model.getByCid(tab.data('panel_id'));

        // Only need to part if it's a channel
        // If the nicklist is empty, we haven't joined the channel as yet
        if (panel.isChannel() && panel.get('members').models.length > 0) {
            kiwi.gateway.part(panel.get('name'));
        } else {
            panel.close();
        }
    },

    next: function () {
        var next = kiwi.app.panels.active.tab.next();
        if (!next.length) next = $('li:first', this.tabs_msgs);

        next.click();
    },
    prev: function () {
        var prev = kiwi.app.panels.active.tab.prev();
        if (!prev.length) prev = $('li:last', this.tabs_msgs);

        prev.click();
    }
});



kiwi.view.TopicBar = Backbone.View.extend({
    events: {
        'keydown input': 'process'
    },

    initialize: function () {
        kiwi.app.panels.bind('active', function (active_panel) {
            this.setCurrentTopic(active_panel.get('topic'));
        }, this);
    },

    process: function (ev) {
        var inp = $(ev.currentTarget),
            inp_val = inp.val();

        if (ev.keyCode !== 13) return;

        if (kiwi.app.panels.active.isChannel()) {
            kiwi.gateway.topic(kiwi.app.panels.active.get('name'), inp_val);
        }
    },

    setCurrentTopic: function (new_topic) {
        new_topic = new_topic || '';

        // We only want a plain text version
        new_topic = $('<div>').html(formatIRCMsg(new_topic));
        $('input', this.$el).val(new_topic.text());
    }
});



kiwi.view.ControlBox = Backbone.View.extend({
    buffer: [],  // Stores previously run commands
    buffer_pos: 0,  // The current position in the buffer

    // Hold tab autocomplete data
    tabcomplete: {active: false, data: [], prefix: ''},

    // Instance of InputPreProcessor
    preprocessor: null,

    events: {
        'keydown input': 'process'
    },

    initialize: function () {
        var that = this;

        this.preprocessor = new InputPreProcessor();
        this.preprocessor.recursive_depth = 5;

        kiwi.gateway.bind('change:nick', function () {
            $('.nick', that.$el).text(this.get('nick'));
        });
    },

    process: function (ev) {
        var that = this,
            inp = $(ev.currentTarget),
            inp_val = inp.val(),
            meta;

        if (navigator.appVersion.indexOf("Mac") !== -1) {
            meta = ev.ctrlKey;
        } else {
            meta = ev.altKey;
        }

        // If not a tab key, reset the tabcomplete data
        if (this.tabcomplete.active && ev.keyCode !== 9) {
            this.tabcomplete.active = false;
            this.tabcomplete.data = [];
            this.tabcomplete.prefix = '';
        }
        
        switch (true) {
        case (ev.keyCode === 13):              // return
            inp_val = inp_val.trim();

            if (inp_val) {
                this.processInput(inp.val());

                this.buffer.push(inp.val());
                this.buffer_pos = this.buffer.length;
            }

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
            break;

        case (ev.keyCode === 37 && meta):            // left
            kiwi.app.panels.view.prev();
            return false;

        case (ev.keyCode === 39 && meta):            // right
            kiwi.app.panels.view.next();
            return false;

        case (ev.keyCode === 9):                     // tab
            this.tabcomplete.active = true;
            if (_.isEqual(this.tabcomplete.data, [])) {
                // Get possible autocompletions
                var ac_data = [];
                $.each(kiwi.app.panels.active.get('members').models, function (i, member) {
                    if (!member) return;
                    ac_data.push(member.get('nick'));
                });
                ac_data = _.sortBy(ac_data, function (nick) {
                    return nick;
                });
                this.tabcomplete.data = ac_data;
            }

            if (inp_val[inp[0].selectionStart - 1] === ' ') {
                return false;
            }
            
            (function () {
                var tokens = inp_val.substring(0, inp[0].selectionStart).split(' '),
                    val,
                    p1,
                    newnick,
                    range,
                    nick = tokens[tokens.length - 1];
                if (this.tabcomplete.prefix === '') {
                    this.tabcomplete.prefix = nick;
                }

                this.tabcomplete.data = _.select(this.tabcomplete.data, function (n) {
                    return (n.toLowerCase().indexOf(that.tabcomplete.prefix.toLowerCase()) === 0);
                });

                if (this.tabcomplete.data.length > 0) {
                    p1 = inp[0].selectionStart - (nick.length);
                    val = inp_val.substr(0, p1);
                    newnick = this.tabcomplete.data.shift();
                    this.tabcomplete.data.push(newnick);
                    val += newnick;
                    val += inp_val.substr(inp[0].selectionStart);
                    inp.val(val);

                    if (inp[0].setSelectionRange) {
                        inp[0].setSelectionRange(p1 + newnick.length, p1 + newnick.length);
                    } else if (inp[0].createTextRange) { // not sure if this bit is actually needed....
                        range = inp[0].createTextRange();
                        range.collapse(true);
                        range.moveEnd('character', p1 + newnick.length);
                        range.moveStart('character', p1 + newnick.length);
                        range.select();
                    }
                }
            }).apply(this);
            return false;
        }
    },


    processInput: function (command_raw) {
        var command, params,
            pre_processed;
        
        // The default command
        if (command_raw[0] !== '/') {
            command_raw = '/msg ' + kiwi.app.panels.active.get('name') + ' ' + command_raw;
        }

        // Process the raw command for any aliases
        this.preprocessor.vars.server = kiwi.gateway.get('name');
        this.preprocessor.vars.channel = kiwi.app.panels.active.get('name');
        this.preprocessor.vars.destination = this.preprocessor.vars.channel;
        command_raw = this.preprocessor.process(command_raw);

        // Extract the command and parameters
        params = command_raw.split(' ');
        if (params[0][0] === '/') {
            command = params[0].substr(1).toLowerCase();
            params = params.splice(1);
        } else {
            // Default command
            command = 'msg';
            params.unshift(kiwi.app.panels.active.get('name'));
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




kiwi.view.StatusMessage = Backbone.View.extend({
    /* Timer for hiding the message */
    tmr: null,

    initialize: function () {
        this.$el.hide();
    },

    text: function (text, opt) {
        // Defaults
        opt = opt || {};
        opt.type = opt.type || '';
        opt.timeout = opt.timeout || 5000;

        this.$el.text(text).attr('class', opt.type);
        this.$el.slideDown(kiwi.app.view.doLayout);

        if (opt.timeout) this.doTimeout(opt.timeout);
    },

    html: function (html, opt) {
        // Defaults
        opt = opt || {};
        opt.type = opt.type || '';
        opt.timeout = opt.timeout || 5000;

        this.$el.html(text).attr('class', opt.type);
        this.$el.slideDown(kiwi.app.view.doLayout);

        if (opt.timeout) this.doTimeout(opt.timeout);
    },

    hide: function () {
        this.$el.slideUp(kiwi.app.view.doLayout);
    },

    doTimeout: function (length) {
        if (this.tmr) clearTimeout(this.tmr);
        var that = this;
        this.tmr = setTimeout(function () { that.hide(); }, length);
    }
});




kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        $(window).resize(this.doLayout);
        $('#toolbar').resize(this.doLayout);
        $('#controlbox').resize(this.doLayout);

        this.doLayout();

        $(document).keydown(this.setKeyFocus);
    },


    // Globally shift focus to the command input box on a keypress
    setKeyFocus: function (ev) {
        // If we're copying text, don't shift focus
        if (ev.ctrlKey || ev.altKey) {
            return;
        }

        // If we're typing into an input box somewhere, ignore
        if (ev.target.tagName.toLowerCase() === 'input') {
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
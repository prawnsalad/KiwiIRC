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
    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick',
        'click .slap': 'slapClick'
    },

    initialize: function () {
        this.$el = $($('#tmpl_userbox').html());
    },

    queryClick: function (event) {
        var panel = new kiwi.model.Query({name: this.member.get('nick')});
        kiwi.app.panels.add(panel);
        panel.view.show();
    },

    infoClick: function (event) {
        kiwi.app.controlbox.processInput('/whois ' + this.member.get('nick'));
    },

    slapClick: function (event) {
        kiwi.app.controlbox.processInput('/slap ' + this.member.get('nick'));
    }
});

kiwi.view.NickChangeBox = Backbone.View.extend({
    events: {
        'submit': 'changeNick',
        'click .cancel': 'close'
    },
    
    initialize: function () {
        this.$el = $($('#tmpl_nickchange').html());
    },
    
    render: function () {
        // Add the UI component and give it focus
        kiwi.app.controlbox.$el.prepend(this.$el);
        this.$el.find('input').focus();

        this.$el.css('bottom', kiwi.app.controlbox.$el.outerHeight(true));
    },
    
    close: function () {
        this.$el.remove();

    },

    changeNick: function (event) {
        var that = this;
        kiwi.gateway.changeNick(this.$el.find('input').val(), function (err, val) {
            that.close();
        });
        return false;
    }
});

kiwi.view.ServerSelect = function () {
    // Are currently showing all the controlls or just a nick_change box?
    var state = 'all';

    var model = Backbone.View.extend({
        events: {
            'submit form': 'submitForm',
            'click .show_more': 'showMore'
        },

        initialize: function () {
            this.$el = $($('#tmpl_server_select').html());

            kiwi.gateway.bind('onconnect', this.networkConnected, this);
            kiwi.gateway.bind('connecting', this.networkConnecting, this);

            kiwi.gateway.bind('onirc_error', function (data) {
                $('button', this.$el).attr('disabled', null);

                if (data.error == 'nickname_in_use') {
                    this.setStatus('Nickname already taken');
                    this.show('nick_change');
                }
            }, this);
        },

        submitForm: function (event) {
            if (state === 'nick_change') {
                this.submitNickChange(event);
            } else {
                this.submitLogin(event);
            }

            $('button', this.$el).attr('disabled', 1);
            return false;
        },

        submitLogin: function (event) {
            // If submitting is disabled, don't do anything
            if ($('button', this.$el).attr('disabled')) return;
            
            var values = {
                nick: $('.nick', this.$el).val(),
                server: $('.server', this.$el).val(),
                port: $('.port', this.$el).val(),
                ssl: $('.ssl', this.$el).prop('checked'),
                password: $('.password', this.$el).val(),
                channel: $('.channel', this.$el).val(),
                channel_key: $('.channel_key', this.$el).val()
            };

            this.trigger('server_connect', values);
        },

        submitNickChange: function (event) {
            kiwi.gateway.changeNick($('.nick', this.$el).val());
            this.networkConnecting();
        },

        showMore: function (event) {
            $('.more', this.$el).slideDown('fast');
            $('.server', this.$el).select();
        },

        populateFields: function (defaults) {
            var nick, server, port, channel, channel_key, ssl, password;

            defaults = defaults || {};

            nick = defaults.nick || '';
            server = defaults.server || '';
            port = defaults.port || 6667;
            ssl = defaults.ssl || 0;
            password = defaults.password || '';
            channel = defaults.channel || '';
            channel_key = defaults.channel_key || '';

            $('.nick', this.$el).val(nick);
            $('.server', this.$el).val(server);
            $('.port', this.$el).val(port);
            $('.ssl', this.$el).prop('checked', ssl);
            $('.password', this.$el).val(password);
            $('.channel', this.$el).val(channel);
            $('.channel_key', this.$el).val(channel_key);
        },

        hide: function () {
            this.$el.slideUp();
        },

        show: function (new_state) {
            new_state = new_state || 'all';

            this.$el.show();

            if (new_state === 'all') {
                $('.show_more', this.$el).show();

            } else if (new_state === 'more') {
                $('.more', this.$el).slideDown('fast');

            } else if (new_state === 'nick_change') {
                $('.more', this.$el).hide();
                $('.show_more', this.$el).hide();
            }

            state = new_state;
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
            $('button', this.$el).attr('disabled', null);
            this.show();
        }
    });


    return new model(arguments);
};


kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick"
    },

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

        this.alert_level = 0;

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

        // Activity/alerts based on the type of new message
        if (msg.type.match(/^action /)) {
            this.alert('action');
        } else if (msg.msg.indexOf(kiwi.gateway.get('nick')) > -1) {
            kiwi.app.view.alertWindow('* People are talking!');
            this.alert('highlight');
        } else {
            // If this is the active panel, send an alert out
            if (this.model.isActive()) {
                kiwi.app.view.alertWindow('* People are talking!');
            }
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
    chanClick: function (event) {
        if (event.target) {
            kiwi.gateway.join($(event.target).text());
        } else {
            // IE...
            kiwi.gateway.join($(event.srcElement).text());
        }
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
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#memberlists').hide().children().removeClass('active');
        }

        kiwi.app.view.doLayout();

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
        
        this.model.addMsg('', '== Topic for ' + this.model.get('name') + ' is: ' + topic, 'topic');

        // If this is the active channel then update the topic bar
        if (kiwi.app.panels.active === this) {
            kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    }
});

// Model for this = kiwi.model.PanelList
kiwi.view.Tabs = Backbone.View.extend({
    events: {
        'click li': 'tabClick',
        'click li .part': 'partClick'
    },

    initialize: function () {
        this.model.on("add", this.panelAdded, this);
        this.model.on("remove", this.panelRemoved, this);
        this.model.on("reset", this.render, this);

        this.model.on('active', this.panelActive, this);

        this.tabs_applets = $('ul.applets', this.$el);
        this.tabs_msg = $('ul.channels', this.$el);

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

        if (panel.isServer()) {
            panel.tab.addClass('server');
        }

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
        $('.part', this.$el).remove();
        this.tabs_applets.children().removeClass('active');
        this.tabs_msg.children().removeClass('active');

        panel.tab.addClass('active');

        // Only show the part image on non-server tabs
        if (!panel.isServer()) {
            panel.tab.append('<span class="part"></span>');
        }
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
        'keydown div': 'process'
    },

    initialize: function () {
        kiwi.app.panels.bind('active', function (active_panel) {
            // If it's a channel topic, update and make editable
            if (active_panel.isChannel()) {
                this.setCurrentTopic(active_panel.get('topic') || '');
                this.$el.find('div').attr('contentEditable', true);

            } else {
                // Not a channel topic.. clear and make uneditable
                this.$el.find('div').attr('contentEditable', false)
                    .text('');
            }
        }, this);
    },

    process: function (ev) {
        var inp = $(ev.currentTarget),
            inp_val = inp.text();
        
        // Only allow topic editing if this is a channel panel
        if (!kiwi.app.panels.active.isChannel()) {
            return false;
        }

        // If hit return key, update the current topic
        if (ev.keyCode === 13) {
            kiwi.gateway.topic(kiwi.app.panels.active.get('name'), inp_val);
            return false;
        }
    },

    setCurrentTopic: function (new_topic) {
        new_topic = new_topic || '';

        // We only want a plain text version
        $('div', this.$el).html(formatIRCMsg(_.escape(new_topic)));
    }
});



kiwi.view.ControlBox = Backbone.View.extend({
    events: {
        'keydown .inp': 'process',
        'click .nick': 'showNickChange'
    },

    initialize: function () {
        var that = this;

        this.buffer = [];  // Stores previously run commands
        this.buffer_pos = 0;  // The current position in the buffer

        this.preprocessor = new InputPreProcessor();
        this.preprocessor.recursive_depth = 5;

        // Hold tab autocomplete data
        this.tabcomplete = {active: false, data: [], prefix: ''};

        kiwi.gateway.bind('change:nick', function () {
            $('.nick', that.$el).text(this.get('nick'));
        });
    },

    showNickChange: function (ev) {
        (new kiwi.view.NickChangeBox()).render();
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
                $.each(inp_val.split('\n'), function (idx, line) {
                    that.processInput(line);
                });

                this.buffer.push(inp_val);
                this.buffer_pos = this.buffer.length;
            }

            inp.val('');
            return false;

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
            params = params.splice(1, params.length - 1);
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
    initialize: function () {
        this.$el.hide();

        // Timer for hiding the message after X seconds
        this.tmr = null;
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




kiwi.view.ResizeHandler = Backbone.View.extend({
    events: {
        'mousedown': 'startDrag',
        'mouseup': 'stopDrag'
    },

    initialize: function () {
        this.dragging = false;
        this.starting_width = {};

        $(window).on('mousemove', $.proxy(this.onDrag, this));
    },

    startDrag: function (event) {
        this.dragging = true;
    },

    stopDrag: function (event) {
        this.dragging = false;
    },

    onDrag: function (event) {
        if (!this.dragging) return;

        this.$el.css('left', event.clientX - (this.$el.outerWidth(true) / 2));
        $('#memberlists').css('width', this.$el.parent().width() - (this.$el.position().left + this.$el.outerWidth()));
        kiwi.app.view.doLayout();
    }
});



kiwi.view.AppToolbar = Backbone.View.extend({
    events: {
        'click .settings': 'clickSettings'
    },

    initialize: function () {
    },

    clickSettings: function (event) {
        kiwi.app.controlbox.processInput('/settings');
    }
});



kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        $(window).resize(this.doLayout);
        $('#toolbar').resize(this.doLayout);
        $('#controlbox').resize(this.doLayout);

        this.doLayout();

        $(document).keydown(this.setKeyFocus);

        // Confirmation require to leave the page
        window.onbeforeunload = function () {
            if (kiwi.gateway.isConnected()) {
                return 'This will close all KiwiIRC conversations. Are you sure you want to close this window?';
            }
        };
    },


    // Globally shift focus to the command input box on a keypress
    setKeyFocus: function (ev) {
        // If we're copying text, don't shift focus
        if (ev.ctrlKey || ev.altKey || ev.metaKey) {
            return;
        }

        // If we're typing into an input box somewhere, ignore
        if ((ev.target.tagName.toLowerCase() === 'input') || $(ev.target).attr('contenteditable')) {
            return;
        }

        $('#controlbox .inp').focus();
    },


    doLayout: function () {
        var el_panels = $('#panels');
        var el_memberlists = $('#memberlists');
        var el_toolbar = $('#toolbar');
        var el_controlbox = $('#controlbox');
        var el_resize_handle = $('#memberlists_resize_handle');

        var css_heights = {
            top: el_toolbar.outerHeight(true),
            bottom: el_controlbox.outerHeight(true)
        };


        // If any elements are not visible, full size the panals instead
        if (!el_toolbar.is(':visible')) {
            css_heights.top = 0;
        }

        if (!el_controlbox.is(':visible')) {
            css_heights.bottom = 0;
        }

        // Apply the CSS sizes
        el_panels.css(css_heights);
        el_memberlists.css(css_heights);
        el_resize_handle.css(css_heights);

        // Set the panels width depending on the memberlist visibility
        if (el_memberlists.css('display') != 'none') {
            // Handle + panels to the side of the memberlist
            el_panels.css('right', el_memberlists.outerWidth(true) + el_resize_handle.outerWidth(true));
            el_resize_handle.css('left', el_memberlists.position().left - el_resize_handle.outerWidth(true));
        } else {
            // Memberlist is hidden so handle + panels to the right edge
            el_panels.css('right', el_resize_handle.outerWidth(true));
            el_resize_handle.css('left', el_panels.outerWidth(true));
        }
    },


    alertWindow: function (title) {
        if (!this.alertWindowTimer) {
            this.alertWindowTimer = new (function () {
                var that = this;
                var tmr;
                var has_focus = true;
                var state = 0;
                var default_title = 'Kiwi IRC';
                var title = 'Kiwi IRC';

                this.setTitle = function (new_title) {
                    new_title = new_title || default_title;
                    window.document.title = new_title;
                    return new_title;
                };

                this.start = function (new_title) {
                    // Don't alert if we already have focus
                    if (has_focus) return;

                    title = new_title;
                    if (tmr) return;
                    tmr = setInterval(this.update, 1000);
                };

                this.stop = function () {
                    // Stop the timer and clear the title
                    if (tmr) clearInterval(tmr);
                    tmr = null;
                    this.setTitle();

                    // Some browsers don't always update the last title correctly
                    // Wait a few seconds and then reset
                    setTimeout(this.reset, 2000);
                };

                this.reset = function () {
                    if (tmr) return;
                    that.setTitle();
                };


                this.update = function () {
                    if (state === 0) {
                        that.setTitle(title);
                        state = 1;
                    } else {
                        that.setTitle();
                        state = 0;
                    }
                };

                $(window).focus(function (event) {
                    has_focus = true;
                    that.stop();

                    // Some browsers don't always update the last title correctly
                    // Wait a few seconds and then reset
                    setTimeout(that.reset, 2000);
                });

                $(window).blur(function (event) {
                    has_focus = false;
                });
            })();
        }

        this.alertWindowTimer.start(title);
    },


    barsHide: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideUp({queue: false, duration: 400, step: this.doLayout});
            $('#controlbox').slideUp({queue: false, duration: 400, step: this.doLayout});
        } else {
            $('#toolbar').slideUp(0);
            $('#controlbox').slideUp(0);
            this.doLayout();
        }
    },

    barsShow: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideDown({queue: false, duration: 400, step: this.doLayout});
            $('#controlbox').slideDown({queue: false, duration: 400, step: this.doLayout});
        } else {
            $('#toolbar').slideDown(0);
            $('#controlbox').slideDown(0);
            this.doLayout();
        }
    }
});
/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */

_kiwi.view.MemberList = Backbone.View.extend({
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
            userbox = new _kiwi.view.UserBox();
        
        userbox.member = member;
        $('.userbox', this.$el).remove();
        target.append(userbox.$el);
    },
    show: function () {
        $('#memberlists').children().removeClass('active');
        $(this.el).addClass('active');
    }
});



_kiwi.view.UserBox = Backbone.View.extend({
    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick',
        'click .slap': 'slapClick'
    },

    initialize: function () {
        this.$el = $($('#tmpl_userbox').html());
    },

    queryClick: function (event) {
        var panel = new _kiwi.model.Query({name: this.member.get('nick')});
        _kiwi.app.panels.add(panel);
        panel.view.show();
    },

    infoClick: function (event) {
        _kiwi.app.controlbox.processInput('/whois ' + this.member.get('nick'));
    },

    slapClick: function (event) {
        _kiwi.app.controlbox.processInput('/slap ' + this.member.get('nick'));
    }
});

_kiwi.view.NickChangeBox = Backbone.View.extend({
    events: {
        'submit': 'changeNick',
        'click .cancel': 'close'
    },
    
    initialize: function () {
        this.$el = $($('#tmpl_nickchange').html());
    },
    
    render: function () {
        // Add the UI component and give it focus
        _kiwi.app.controlbox.$el.prepend(this.$el);
        this.$el.find('input').focus();

        this.$el.css('bottom', _kiwi.app.controlbox.$el.outerHeight(true));
    },
    
    close: function () {
        this.$el.remove();

    },

    changeNick: function (event) {
        var that = this;
        _kiwi.gateway.changeNick(this.$el.find('input').val(), function (err, val) {
            that.close();
        });
        return false;
    }
});

_kiwi.view.ServerSelect = function () {
    // Are currently showing all the controlls or just a nick_change box?
    var state = 'all';

    var model = Backbone.View.extend({
        events: {
            'submit form': 'submitForm',
            'click .show_more': 'showMore'
        },

        initialize: function () {
            this.$el = $($('#tmpl_server_select').html());

            // Remove the 'more' link if the server has disabled server changing
            if (_kiwi.app.server_settings && _kiwi.app.server_settings.connection) {
                if (!_kiwi.app.server_settings.connection.allow_change) {
                    this.$el.find('.show_more').remove();
                    this.$el.addClass('single_server');
                }
            }


            _kiwi.gateway.bind('onconnect', this.networkConnected, this);
            _kiwi.gateway.bind('connecting', this.networkConnecting, this);

            _kiwi.gateway.bind('onirc_error', function (data) {
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
            _kiwi.gateway.changeNick($('.nick', this.$el).val());
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


_kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick",
        'click .media .open': 'mediaClick',
        'mouseenter .msg .nick': 'msgEnter',
        'mouseleave .msg .nick': 'msgLeave'
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
            nick_colour_hex, nick_hex, is_highlight, msg_css_classes = '';

        // Nick highlight detecting
        if ((new RegExp('\\b' + _kiwi.gateway.get('nick') + '\\b', 'i')).test(msg.msg)) {
            is_highlight = true;
            msg_css_classes += ' highlight';
        }

        // Escape any HTML that may be in here
        msg.msg =  $('<div />').text(msg.msg).html();

        // Make the channels clickable
        re = new RegExp('(?:^|\\s)([' + _kiwi.gateway.get('channel_prefix') + '][^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan" data-channel="' + match.trim() + '">' + match + '</a>';
        });


        // Parse any links found
        msg.msg = msg.msg.replace(/(([A-Za-z0-9\-]+\:\/\/)|(www\.))([\w.]+)([a-zA-Z]{2,6})(:[0-9]+)?(\/[\w#!:.?$'()[\]*,;~+=&%@!\-\/]*)?/gi, function (url) {
            var nice, extra_html = '';

            // Add the http if no protoocol was found
            if (url.match(/^www\./)) {
                url = 'http://' + url;
            }

            // Shorten the displayed URL if it's going to be too long
            nice = url;
            if (nice.length > 100) {
                nice = nice.substr(0, 100) + '...';
            }

            // Get any media HTML if supported
            extra_html = _kiwi.view.MediaMessage.buildHtml(url);

            // Make the link clickable
            return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '</a> ' + extra_html;
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

        // Generate a hex string from the nick to be used as a CSS class name
        nick_hex = msg.nick_css_class = '';
        if (msg.nick) {
            _.map(msg.nick.split(''), function (char) {
                nick_hex += char.charCodeAt(0).toString(16);
            });
            msg_css_classes += ' nick_' + nick_hex;
        }

        // Build up and add the line
        msg.msg_css_classes = msg_css_classes;
        line_msg = '<div class="msg <%= type %> <%= msg_css_classes %>"><div class="time"><%- time %></div><div class="nick" style="<%= nick_style %>"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
        $this.append(_.template(line_msg, msg));

        // Activity/alerts based on the type of new message
        if (msg.type.match(/^action /)) {
            this.alert('action');
        } else if (is_highlight) {
            _kiwi.app.view.alertWindow('* People are talking!');
            this.alert('highlight');
        } else {
            // If this is the active panel, send an alert out
            if (this.model.isActive()) {
                _kiwi.app.view.alertWindow('* People are talking!');
            }
            this.alert('activity');
        }

        this.scrollToBottom();

        // Make sure our DOM isn't getting too large (Acts as scrollback)
        this.msg_count++;
        if (this.msg_count > (parseInt(_kiwi.global.settings.get('scrollback'), 10) || 250)) {
            $('.msg:first', this.$el).remove();
            this.msg_count--;
        }
    },
    chanClick: function (event) {
        if (event.target) {
            _kiwi.gateway.join($(event.target).data('channel'));
        } else {
            // IE...
            _kiwi.gateway.join($(event.srcElement).data('channel'));
        }
    },

    mediaClick: function (event) {
        var $media = $(event.target).parents('.media');
        var media_message;

        if ($media.data('media')) {
            media_message = $media.data('media');
        } else {
            media_message = new _kiwi.view.MediaMessage({el: $media[0]});
            $media.data('media', media_message);
        }

        $media.data('media', media_message);

        media_message.open();
    },

    msgEnter: function (event) {
        var nick_class;

        // Find a valid class that this element has
        _.each($(event.currentTarget).parent('.msg').attr('class').split(' '), function (css_class) {
            if (css_class.match(/^nick_[a-z0-9]+/i)) {
                nick_class = css_class;
            }
        });

        // If no class was found..
        if (!nick_class) return;

        $('.'+nick_class).addClass('global_nick_highlight');
    },

    msgLeave: function (event) {
        var nick_class;

        // Find a valid class that this element has
        _.each($(event.currentTarget).parent('.msg').attr('class').split(' '), function (css_class) {
            if (css_class.match(/^nick_[a-z0-9]+/i)) {
                nick_class = css_class;
            }
        });

        // If no class was found..
        if (!nick_class) return;

        $('.'+nick_class).removeClass('global_nick_highlight');
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

        _kiwi.app.view.doLayout();
        this.alert('none');

        this.trigger('active', this.model);
        _kiwi.app.panels.trigger('active', this.model);

        this.scrollToBottom(true);
    },


    alert: function (level) {
        // No need to highlight if this si the active panel
        if (this.model == _kiwi.app.panels.active) return;

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
    scrollToBottom: function (force_down) {
        // If this isn't the active panel, don't scroll
        if (this.model !== _kiwi.app.panels.active) return;

        // Don't scroll down if we're scrolled up the panel a little
        if (force_down || this.$container.scrollTop() + this.$container.height() > this.$el.outerHeight() - 150) {
            this.$container[0].scrollTop = this.$container[0].scrollHeight;
        }
    }
});

_kiwi.view.Applet = _kiwi.view.Panel.extend({
    className: 'applet',
    initialize: function (options) {
        this.initializePanel(options);
    }
});

_kiwi.view.Channel = _kiwi.view.Panel.extend({
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
        if (_kiwi.app.panels.active === this) {
            _kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    }
});

// Model for this = _kiwi.model.PanelList
_kiwi.view.Tabs = Backbone.View.extend({
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

        _kiwi.gateway.on('change:name', function (gateway, new_val) {
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

        _kiwi.app.view.doLayout();
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
        _kiwi.app.view.doLayout();
    },
    panelRemoved: function (panel) {
        panel.tab.remove();
        delete panel.tab;

        _kiwi.app.view.doLayout();
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
            _kiwi.gateway.part(panel.get('name'));
        } else {
            panel.close();
        }
    },

    next: function () {
        var next = _kiwi.app.panels.active.tab.next();
        if (!next.length) next = $('li:first', this.tabs_msgs);

        next.click();
    },
    prev: function () {
        var prev = _kiwi.app.panels.active.tab.prev();
        if (!prev.length) prev = $('li:last', this.tabs_msgs);

        prev.click();
    }
});



_kiwi.view.TopicBar = Backbone.View.extend({
    events: {
        'keydown div': 'process'
    },

    initialize: function () {
        _kiwi.app.panels.bind('active', function (active_panel) {
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
        if (!_kiwi.app.panels.active.isChannel()) {
            return false;
        }

        // If hit return key, update the current topic
        if (ev.keyCode === 13) {
            _kiwi.gateway.topic(_kiwi.app.panels.active.get('name'), inp_val);
            return false;
        }
    },

    setCurrentTopic: function (new_topic) {
        new_topic = new_topic || '';

        // We only want a plain text version
        $('div', this.$el).html(formatIRCMsg(_.escape(new_topic)));
    }
});



_kiwi.view.ControlBox = Backbone.View.extend({
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

        _kiwi.gateway.bind('change:nick', function () {
            $('.nick', that.$el).text(this.get('nick'));
        });
    },

    showNickChange: function (ev) {
        (new _kiwi.view.NickChangeBox()).render();
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
            _kiwi.app.panels.view.prev();
            return false;

        case (ev.keyCode === 39 && meta):            // right
            _kiwi.app.panels.view.next();
            return false;

        case (ev.keyCode === 9):                     // tab
            this.tabcomplete.active = true;
            if (_.isEqual(this.tabcomplete.data, [])) {
                // Get possible autocompletions
                var ac_data = [];
                $.each(_kiwi.app.panels.active.get('members').models, function (i, member) {
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
        if (command_raw[0] !== '/' || command_raw.substr(0, 2) === '//') {
            // Remove any slash escaping at the start (ie. //)
            command_raw = command_raw.replace(/^\/\//, '/');

            // Prepend the default command
            command_raw = '/msg ' + _kiwi.app.panels.active.get('name') + ' ' + command_raw;
        }

        // Process the raw command for any aliases
        this.preprocessor.vars.server = _kiwi.gateway.get('name');
        this.preprocessor.vars.channel = _kiwi.app.panels.active.get('name');
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
            params.unshift(_kiwi.app.panels.active.get('name'));
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




_kiwi.view.StatusMessage = Backbone.View.extend({
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
        this.$el.slideDown(_kiwi.app.view.doLayout);

        if (opt.timeout) this.doTimeout(opt.timeout);
    },

    html: function (html, opt) {
        // Defaults
        opt = opt || {};
        opt.type = opt.type || '';
        opt.timeout = opt.timeout || 5000;

        this.$el.html(text).attr('class', opt.type);
        this.$el.slideDown(_kiwi.app.view.doLayout);

        if (opt.timeout) this.doTimeout(opt.timeout);
    },

    hide: function () {
        this.$el.slideUp(_kiwi.app.view.doLayout);
    },

    doTimeout: function (length) {
        if (this.tmr) clearTimeout(this.tmr);
        var that = this;
        this.tmr = setTimeout(function () { that.hide(); }, length);
    }
});




_kiwi.view.ResizeHandler = Backbone.View.extend({
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
        _kiwi.app.view.doLayout();
    }
});



_kiwi.view.AppToolbar = Backbone.View.extend({
    events: {
        'click .settings': 'clickSettings'
    },

    initialize: function () {
    },

    clickSettings: function (event) {
        _kiwi.app.controlbox.processInput('/settings');
    }
});



_kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        $(window).resize(this.doLayout);
        $('#toolbar').resize(this.doLayout);
        $('#controlbox').resize(this.doLayout);

        // Change the theme when the config is changed
        _kiwi.global.settings.on('change:theme', this.updateTheme, this);
        this.updateTheme(getQueryVariable('theme'));

        this.doLayout();

        $(document).keydown(this.setKeyFocus);

        // Confirmation require to leave the page
        window.onbeforeunload = function () {
            if (_kiwi.gateway.isConnected()) {
                return 'This will close all KiwiIRC conversations. Are you sure you want to close this window?';
            }
        };
    },



    updateTheme: function (theme_name) {
        // If called by the settings callback, get the correct new_value
        if (theme_name === _kiwi.global.settings) {
            theme_name = arguments[1];
        }

        // If we have no theme specified, get it from the settings
        if (!theme_name) theme_name = _kiwi.global.settings.get('theme');

        // Clear any current theme
        this.$el.removeClass(function (i, css) {
            return (css.match(/\btheme_\S+/g) || []).join(' ');
        });

        // Apply the new theme
        this.$el.addClass('theme_' + (theme_name || 'relaxed'));
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









_kiwi.view.MediaMessage = Backbone.View.extend({
    events: {
        'click .media_close': 'close'
    },

    initialize: function () {
        // Get the URL from the data
        this.url = this.$el.data('url');
    },

    // Close the media content and remove it from display
    close: function () {
        var that = this;
        this.$content.slideUp('fast', function () {
            that.$content.remove();
        });
    },

    // Open the media content within its wrapper
    open: function () {
        // Create the content div if we haven't already
        if (!this.$content) {
            this.$content = $('<div class="media_content"><a class="media_close"><i class="icon-chevron-up"></i> Close media</a><br /></div>');
            this.$content.append('<a href="' + this.url + '" target="_blank"><img height="100" src="' + this.url + '" /></a>');
        }

        // Now show the content if not already
        if (!this.$content.is(':visible')) {
            // Hide it first so the slideDown always plays
            this.$content.hide();

            // Add the media content and slide it into view
            this.$el.append(this.$content);
            this.$content.slideDown();
        }
    }

}, {

    // Build the closed media HTML from a URL
    buildHtml: function (url) {
        var html = '';

        // Is it an image?
        if (url.match(/(\.jpe?g|\.gif|\.bmp|\.png)\??$/i)) {
            html += '<span class="media" data-url="' + url + '" title="Open Image"><a class="open"><i class="icon-chevron-right"></i></a></span>';
        }

        return html;
    }
}
);
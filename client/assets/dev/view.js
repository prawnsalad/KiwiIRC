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
            var prefix_css_class = (member.get('modes') || []).join(' ');
            $('<li class="mode ' + prefix_css_class + '"><a class="nick"><span class="prefix">' + member.get("prefix") + '</span>' + member.get("nick") + '</a></li>')
                .appendTo($this)
                .data('member', member);
        });
    },
    nickClick: function (event) {
        var $target = $(event.currentTarget).parent('li'),
            member = $target.data('member'),
            userbox;
        
        event.stopPropagation();

        // If the userbox already exists here, hide it
        if ($target.find('.userbox').length > 0) {
            $('.userbox', this.$el).remove();
            return;
        }

        userbox = new _kiwi.view.UserBox();
        userbox.member = member;
        userbox.channel = this.model.channel;

        if (!this.model.getByNick(_kiwi.gateway.get('nick')).get('is_op')) {
            userbox.$el.children('.if_op').remove();
        }

        var menu = new _kiwi.view.MenuBox(member.get('nick') || 'User');
        menu.addItem('userbox', userbox.$el);
        menu.show();

        // Position the userbox + menubox
        (function() {
            var t = event.pageY,
                m_bottom = t + menu.$el.outerHeight(),  // Where the bottom of menu will be
                memberlist_bottom = this.$el.parent().offset().top + this.$el.parent().outerHeight();

            // If the bottom of the userbox is going to be too low.. raise it
            if (m_bottom > memberlist_bottom){
                t = memberlist_bottom - menu.$el.outerHeight();
            }

            // Set the new positon
            menu.$el.offset({
                left: _kiwi.app.view.$el.width() - menu.$el.outerWidth() - 20,
                top: t
            });
        }).call(this);
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
        'click .slap': 'slapClick',
        'click .op': 'opClick',
        'click .deop': 'deopClick',
        'click .voice': 'voiceClick',
        'click .devoice': 'devoiceClick',
        'click .kick': 'kickClick',
        'click .ban': 'banClick'
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
    },

    opClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +o ' + this.member.get('nick'));
    },

    deopClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -o ' + this.member.get('nick'));
    },

    voiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +v ' + this.member.get('nick'));
    },

    devoiceClick: function (event) {
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' -v ' + this.member.get('nick'));
    },

    kickClick: function (event) {
        // TODO: Enable the use of a custom kick message
        _kiwi.app.controlbox.processInput('/kick ' + this.member.get('nick') + ' Bye!');
    },

    banClick: function (event) {
        // TODO: Set ban on host, not just on nick
        _kiwi.app.controlbox.processInput('/mode ' + this.channel.get('name') + ' +b ' + this.member.get('nick') + '!*');
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
            'click .show_more': 'showMore',
            'change .have_pass input': 'showPass'
        },

        initialize: function () {
            var that = this;

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

                if (data.error == 'password_mismatch') {
                    this.setStatus('Incorrect Password');
                    this.show('nick_change');
                    that.$el.find('.password').select();
                }
            }, this);
        },

        submitForm: function (event) {
            event.preventDefault();

            // Make sure a nick is chosen
            if (!$('input.nick', this.$el).val().trim()) {
                this.setStatus('Select a nickname first!');
                $('input.nick', this.$el).select();
                return;
            }

            if (state === 'nick_change') {
                this.submitNickChange(event);
            } else {
                this.submitLogin(event);
            }

            $('button', this.$el).attr('disabled', 1);
            return;
        },

        submitLogin: function (event) {
            // If submitting is disabled, don't do anything
            if ($('button', this.$el).attr('disabled')) return;
            
            var values = {
                nick: $('input.nick', this.$el).val(),
                server: $('input.server', this.$el).val(),
                port: $('input.port', this.$el).val(),
                ssl: $('input.ssl', this.$el).prop('checked'),
                password: $('input.password', this.$el).val(),
                channel: $('input.channel', this.$el).val(),
                channel_key: $('input.channel_key', this.$el).val()
            };

            this.trigger('server_connect', values);
        },

        submitNickChange: function (event) {
            _kiwi.gateway.changeNick($('input.nick', this.$el).val());
            this.networkConnecting();
        },

        showPass: function (event) {
            if (this.$el.find('tr.have_pass input').is(':checked')) {
                this.$el.find('tr.pass').show().find('input').focus();
            } else {
                this.$el.find('tr.pass').hide().find('input').val('');
            }
        },

        showMore: function (event) {
            $('.more', this.$el).slideDown('fast');
            $('input.server', this.$el).select();
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

            $('input.nick', this.$el).val(nick);
            $('input.server', this.$el).val(server);
            $('input.port', this.$el).val(port);
            $('input.ssl', this.$el).prop('checked', ssl);
            $('input.password', this.$el).val(password);
            $('input.channel', this.$el).val(channel);
            $('input.channel_key', this.$el).val(channel_key);
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
                $('input.nick', this.$el).select();
            }

            state = new_state;
        },

        setStatus: function (text, class_name) {
            $('.status', this.$el)
                .text(text)
                .attr('class', 'status')
                .addClass(class_name||'')
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
        var that = this;

        this.$el.empty();
        _.each(this.model.get('scrollback'), function (msg) {
            that.newMsg(msg);
        });
    },

    newMsg: function (msg) {
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
        msg.msg = msg.msg.replace(/(([A-Za-z0-9\-]+\:\/\/)|(www\.))([\w.\-]+)([a-zA-Z]{2,6})(:[0-9]+)?(\/[\w#!:.?$'()[\]*,;~+=&%@!\-\/]*)?/gi, function (url) {
            var nice = url,
                extra_html = '';

            // Add the http if no protoocol was found
            if (url.match(/^www\./)) {
                url = 'http://' + url;
            }

            // Shorten the displayed URL if it's going to be too long
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
            _kiwi.app.view.playSound('highlight');
            this.alert('highlight');

        } else {
            // If this is the active panel, send an alert out
            if (this.model.isActive()) {
                _kiwi.app.view.alertWindow('* People are talking!');
            }
            this.alert('activity');
        }

        if (this.model.isQuery() && !this.model.isActive()) {
            _kiwi.app.view.alertWindow('* People are talking!');
            _kiwi.app.view.playSound('highlight');
        }

        // Update the activity counters
        (function () {
            // Only inrement the counters if we're not the active panel
            if (this.model.isActive()) return;

            var $act = this.model.tab.find('.activity');
            $act.text((parseInt($act.text(), 10) || 0) + 1);
            if ($act.text() === '0') {
                $act.addClass('zero');
            } else {
                $act.removeClass('zero');
            }
        }).apply(this);

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

    // Cursor hovers over a message
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

    // Cursor leaves message
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
            $('#memberlists').removeClass('disabled');
            members.view.show();
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#memberlists').addClass('disabled').children().removeClass('active');
        }

        _kiwi.app.view.doLayout();

        // Remove any alerts and activity counters for this panel
        this.alert('none');
        this.model.tab.find('.activity').text('0').addClass('zero');

        this.trigger('active', this.model);
        _kiwi.app.panels.trigger('active', this.model, _kiwi.app.panels.active);

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

        // Only show the loader if this is a channel (ie. not a query)
        if (this.model.isChannel()) {
            this.$el.append('<div class="initial_loader" style="margin:1em;text-align:center;">Joining channel.. <span class="loader"></span></div>');
        }
    },

    // Override the existing newMsg() method to remove the joining channel loader
    newMsg: function () {
        this.$el.find('.initial_loader').slideUp(function () {
            $(this).remove();
        });

        return this.constructor.__super__.newMsg.apply(this, arguments);
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
        panel.tab = $('<li><span>' + (panel.get('title') || panel.get('name')) + '</span><div class="activity"></div></li>');

        if (panel.isServer()) {
            panel.tab.addClass('server');
            panel.tab.addClass('icon-nonexistant');
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

    panelActive: function (panel, previously_active_panel) {
        // Remove any existing tabs or part images
        $('.part', this.$el).remove();
        this.tabs_applets.children().removeClass('active');
        this.tabs_msg.children().removeClass('active');

        panel.tab.addClass('active');

        // Only show the part image on non-server tabs
        if (!panel.isServer()) {
            panel.tab.append('<span class="part icon-nonexistant"></span>');
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
            meta = ev.metaKey;
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

        case (ev.keyCode === 219 && meta):            // [ + meta
            _kiwi.app.panels.view.prev();
            return false;

        case (ev.keyCode === 221 && meta):            // ] + meta
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
                var tokens,              // Words before the cursor position
                    val,                 // New value being built up
                    p1,                  // Position in the value just before the nick 
                    newnick,             // New nick to be displayed (cycles through)
                    range,               // TextRange for setting new text cursor position
                    nick,                // Current nick in the value
                    trailing = ': ';     // Text to be inserted after a tabbed nick

                tokens = inp_val.substring(0, inp[0].selectionStart).split(' ');
                if (tokens[tokens.length-1] == ':')
                    tokens.pop();

                nick  = tokens[tokens.length - 1];

                if (this.tabcomplete.prefix === '') {
                    this.tabcomplete.prefix = nick;
                }

                this.tabcomplete.data = _.select(this.tabcomplete.data, function (n) {
                    return (n.toLowerCase().indexOf(that.tabcomplete.prefix.toLowerCase()) === 0);
                });

                if (this.tabcomplete.data.length > 0) {
                    // Get the current value before cursor position
                    p1 = inp[0].selectionStart - (nick.length);
                    val = inp_val.substr(0, p1);

                    // Include the current selected nick
                    newnick = this.tabcomplete.data.shift();
                    this.tabcomplete.data.push(newnick);
                    val += newnick;

                    if (inp_val.substr(inp[0].selectionStart, 2) !== trailing)
                        val += trailing;

                    // Now include the rest of the current value
                    val += inp_val.substr(inp[0].selectionStart);

                    inp.val(val);

                    // Move the cursor position to the end of the nick
                    if (inp[0].setSelectionRange) {
                        inp[0].setSelectionRange(p1 + newnick.length + trailing.length, p1 + newnick.length + trailing.length);
                    } else if (inp[0].createTextRange) { // not sure if this bit is actually needed....
                        range = inp[0].createTextRange();
                        range.collapse(true);
                        range.moveEnd('character', p1 + newnick.length + trailing.length);
                        range.moveStart('character', p1 + newnick.length + trailing.length);
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
        this.trigger('command:' + command, {command: command, params: params});

        // If we didn't have any listeners for this event, fire a special case
        // TODO: This feels dirty. Should this really be done..?
        if (!this._callbacks['command:' + command]) {
            this.trigger('unknown_command', {command: command, params: params});
        }
    },


    addPluginIcon: function ($icon) {
        var $tool = $('<div class="tool"></div>').append($icon);
        this.$el.find('.input_tools').append($tool);
        _kiwi.app.view.doLayout();
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
        this.$el.slideDown($.proxy(_kiwi.app.view.doLayout, this));

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
        this.$el.slideUp($.proxy(_kiwi.app.view.doLayout, this));
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
        var that = this;

        $(window).resize(function() { that.doLayout.apply(that); });
        $('#toolbar').resize(function() { that.doLayout.apply(that); });
        $('#controlbox').resize(function() { that.doLayout.apply(that); });

        // Change the theme when the config is changed
        _kiwi.global.settings.on('change:theme', this.updateTheme, this);
        this.updateTheme(getQueryVariable('theme'));

        _kiwi.global.settings.on('change:channel_list_style', this.setTabLayout, this);
        this.setTabLayout(_kiwi.global.settings.get('channel_list_style'));

        _kiwi.global.settings.on('change:show_timestamps', this.displayTimestamps, this);
        this.displayTimestamps(_kiwi.global.settings.get('show_timestamps'));

        this.doLayout();

        $(document).keydown(this.setKeyFocus);

        // Confirmation require to leave the page
        window.onbeforeunload = function () {
            if (_kiwi.gateway.isConnected()) {
                return 'This will close all KiwiIRC conversations. Are you sure you want to close this window?';
            }
        };

        this.initSound();
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


    setTabLayout: function (layout_style) {
        // If called by the settings callback, get the correct new_value
        if (layout_style === _kiwi.global.settings) {
            layout_style = arguments[1];
        }
        
        if (layout_style == 'list') {
            this.$el.addClass('chanlist_treeview');
        } else {
            this.$el.removeClass('chanlist_treeview');
        }
        
        this.doLayout();
    },


    displayTimestamps: function (show_timestamps) {
        // If called by the settings callback, get the correct new_value
        if (show_timestamps === _kiwi.global.settings) {
            show_timestamps = arguments[1];
        }

        if (show_timestamps) {
            this.$el.addClass('timestamps');
        } else {
            this.$el.removeClass('timestamps');
        }
    },


    // Globally shift focus to the command input box on a keypress
    setKeyFocus: function (ev) {
        // If we're copying text, don't shift focus
        if (ev.ctrlKey || ev.altKey || ev.metaKey) {
            return;
        }

        // If we're typing into an input box somewhere, ignore
        if ((ev.target.tagName.toLowerCase() === 'input') || (ev.target.tagName.toLowerCase() === 'textarea') || $(ev.target).attr('contenteditable')) {
            return;
        }

        $('#controlbox .inp').focus();
    },


    doLayout: function () {
        var el_kiwi = this.$el;
        var el_panels = $('#kiwi #panels');
        var el_memberlists = $('#kiwi #memberlists');
        var el_toolbar = $('#kiwi #toolbar');
        var el_controlbox = $('#kiwi #controlbox');
        var el_resize_handle = $('#kiwi #memberlists_resize_handle');

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

        // If we have channel tabs on the side, adjust the height
        if (el_kiwi.hasClass('chanlist_treeview')) {
            $('#tabs', el_kiwi).css(css_heights);
        }

        // Determine if we have a narrow window (mobile/tablet/or even small desktop window)
        if (el_kiwi.outerWidth() < 400) {
            el_kiwi.addClass('narrow');
        } else {
            el_kiwi.removeClass('narrow');
        }

        // Set the panels width depending on the memberlist visibility
        if (el_memberlists.css('display') != 'none') {
            // Panels to the side of the memberlist
            el_panels.css('right', el_memberlists.outerWidth(true));
            // The resize handle sits overlapping the panels and memberlist
            el_resize_handle.css('left', el_memberlists.position().left - (el_resize_handle.outerWidth(true) / 2));
        } else {
            // Memberlist is hidden so panels to the right edge
            el_panels.css('right', 0);
            // And move the handle just out of sight to the right
            el_resize_handle.css('left', el_panels.outerWidth(true));
        }

        var input_wrap_width = parseInt($('#kiwi #controlbox .input_tools').outerWidth());
        el_controlbox.find('.input_wrap').css('right', input_wrap_width + 7);
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
            $('#toolbar').slideUp({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
            $('#controlbox').slideUp({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
        } else {
            $('#toolbar').slideUp(0);
            $('#controlbox').slideUp(0);
            this.doLayout();
        }
    },

    barsShow: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideDown({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
            $('#controlbox').slideDown({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
        } else {
            $('#toolbar').slideDown(0);
            $('#controlbox').slideDown(0);
            this.doLayout();
        }
    },


    initSound: function () {
        var that = this,
            base_path = this.model.get('base_path');

        $script(base_path + '/assets/libs/soundmanager2/soundmanager2-nodebug-jsmin.js', function() {
            if (typeof soundManager === 'undefined')
                return;

            soundManager.setup({
                url: base_path + '/assets/libs/soundmanager2/',
                flashVersion: 9, // optional: shiny features (default = 8)// optional: ignore Flash where possible, use 100% HTML5 mode
                preferFlash: true,

                onready: function() {
                    that.sound_object = soundManager.createSound({
                        id: 'highlight',
                        url: base_path + '/assets/sound/highlight.mp3'
                    });
                }
            });
        });
    },


    playSound: function (sound_id) {
        if (!this.sound_object) return;

        if (_kiwi.global.settings.get('mute_sounds'))
            return;
        
        soundManager.play(sound_id);
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
            this.$content = $('<div class="media_content"><a class="media_close"><i class="icon-chevron-up"></i> Close media</a><br /><div class="content"></div></div>');
            this.$content.find('.content').append(this.mediaTypes[this.$el.data('type')].apply(this, []) || 'Not found :(');
        }

        // Now show the content if not already
        if (!this.$content.is(':visible')) {
            // Hide it first so the slideDown always plays
            this.$content.hide();

            // Add the media content and slide it into view
            this.$el.append(this.$content);
            this.$content.slideDown();
        }
    },



    // Generate the media content for each recognised type
    mediaTypes: {
        twitter: function () {
            var tweet_id = this.$el.data('tweetid');
            var that = this;

            $.getJSON('https://api.twitter.com/1/statuses/oembed.json?id=' + tweet_id + '&callback=?', function (data) {
                that.$content.find('.content').html(data.html);
            });

            return $('<div>Loading tweet..</div>');
        },


        image: function () {
            return $('<a href="' + this.url + '" target="_blank"><img height="100" src="' + this.url + '" /></a>');
        },


        reddit: function () {
            var that = this;
            var matches = (/reddit\.com\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-z0-9]+)\/([^\/]+)?/gi).exec(this.url);

            $.getJSON('http://www.' + matches[0] + '.json?jsonp=?', function (data) {
                console.log('Loaded reddit data', data);
                var post = data[0].data.children[0].data;
                var thumb = '';

                // Show a thumbnail if there is one
                if (post.thumbnail) {
                    //post.thumbnail = 'http://www.eurotunnel.com/uploadedImages/commercial/back-steps-icon-arrow.png';

                    // Hide the thumbnail if an over_18 image
                    if (post.over_18) {
                        thumb = '<span class="thumbnail_nsfw" onclick="$(this).find(\'p\').remove(); $(this).find(\'img\').css(\'visibility\', \'visible\');">';
                        thumb += '<p style="font-size:0.9em;line-height:1.2em;cursor:pointer;">Show<br />NSFW</p>';
                        thumb += '<img src="' + post.thumbnail + '" class="thumbnail" style="visibility:hidden;" />';
                        thumb += '</span>';
                    } else {
                        thumb = '<img src="' + post.thumbnail + '" class="thumbnail" />';
                    }
                }

                // Build the template string up
                var tmpl = '<div>' + thumb + '<b><%- title %></b><br />Posted by <%- author %>. &nbsp;&nbsp; ';
                tmpl += '<i class="icon-arrow-up"></i> <%- ups %> &nbsp;&nbsp; <i class="icon-arrow-down"></i> <%- downs %><br />';
                tmpl += '<%- num_comments %> comments made. <a href="http://www.reddit.com<%- permalink %>">View post</a></div>';

                that.$content.find('.content').html(_.template(tmpl, post));
            });

            return $('<div>Loading Reddit thread..</div>');
        }
    }

}, {

    // Build the closed media HTML from a URL
    buildHtml: function (url) {
        var html = '', matches;

        // Is it an image?
        if (url.match(/(\.jpe?g|\.gif|\.bmp|\.png)\??$/i)) {
            html += '<span class="media image" data-type="image" data-url="' + url + '" title="Open Image"><a class="open"><i class="icon-chevron-right"></i></a></span>';
        }

        // Is it a tweet?
        matches = (/https?:\/\/twitter.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/ig).exec(url);
        if (matches) {
            html += '<span class="media twitter" data-type="twitter" data-url="' + url + '" data-tweetid="' + matches[2] + '" title="Show tweet information"><a class="open"><i class="icon-chevron-right"></i></a></span>';
        }

        // Is reddit?
        matches = (/reddit\.com\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-z0-9]+)\/([^\/]+)?/gi).exec(url);
        if (matches) {
            html += '<span class="media reddit" data-type="reddit" data-url="' + url + '" title="Reddit thread"><a class="open"><i class="icon-chevron-right"></i></a></span>';
        }

        return html;
    }
});



_kiwi.view.MenuBox = Backbone.View.extend({
    events: {
        'click .ui_menu_foot .close': 'dispose'
    },

    initialize: function(title) {
        var that = this;

        this.$el = $('<div class="ui_menu"></div>');

        this._title = title || '';
        this._items = {};
        this._display_footer = true;

        this._close_proxy = function(event) {
            that.onDocumentClick(event);
        };
        $(document).on('click', this._close_proxy);
    },


    render: function() {
        var that = this;

        this.$el.find('*').remove();

        if (this._title) {
            $('<div class="ui_menu_title"></div>')
                .text(this._title)
                .appendTo(this.$el);
        }


        _.each(this._items, function(item) {
            var $item = $('<div class="ui_menu_content hover"></div>')
                .append(item);

            that.$el.append($item);
        });

        if (this._display_footer)
            this.$el.append('<div class="ui_menu_foot"><a class="close" onclick="">Close <i class="icon-remove"></i></a></div>');
    },


    onDocumentClick: function(event) {
        var $target = $(event.target);

        // If this is not itself AND we don't contain this element, dispose $el
        if ($target[0] != this.$el[0] && this.$el.has($target).length === 0)
            this.dispose();
    },


    dispose: function() {
        _.each(this._items, function(item) {
            item.dispose && item.dispose();
            item.remove && item.remove();
        });

        this._items = null;
        this.remove();

        $(document).off('click', this._close_proxy);
    },


    addItem: function(item_name, $item) {
        $item = $($item);
        if ($item.is('a')) $item.addClass('icon-chevron-right');
        this._items[item_name] = $item;
    },


    removeItem: function(item_name) {
        delete this._items[item_name];
    },


    showFooter: function(show) {
        this._show_footer = show;
    },


    show: function() {
        this.render();
        this.$el.appendTo(_kiwi.app.view.$el);
    }
});

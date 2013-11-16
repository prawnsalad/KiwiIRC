_kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        var that = this;

        this.$el = $($('#tmpl_application').html().trim());
        this.el = this.$el[0];

        $(this.model.get('container') || 'body').append(this.$el);

        this.elements = {
            panels:        this.$el.find('.panels'),
            memberlists:   this.$el.find('.memberlists'),
            toolbar:       this.$el.find('.toolbar'),
            controlbox:    this.$el.find('.controlbox'),
            resize_handle: this.$el.find('.memberlists_resize_handle')
        };

        $(window).resize(function() { that.doLayout.apply(that); });
        this.elements.toolbar.resize(function() { that.doLayout.apply(that); });
        this.elements.controlbox.resize(function() { that.doLayout.apply(that); });

        // Change the theme when the config is changed
        _kiwi.global.settings.on('change:theme', this.updateTheme, this);
        this.updateTheme(getQueryVariable('theme'));

        _kiwi.global.settings.on('change:channel_list_style', this.setTabLayout, this);
        this.setTabLayout(_kiwi.global.settings.get('channel_list_style'));

        _kiwi.global.settings.on('change:show_timestamps', this.displayTimestamps, this);
        this.displayTimestamps(_kiwi.global.settings.get('show_timestamps'));

        this.$el.appendTo($('body'));
        this.doLayout();

        $(document).keydown(this.setKeyFocus);

        // Confirmation require to leave the page
        window.onbeforeunload = function () {
            if (_kiwi.gateway.isConnected()) {
                return _kiwi.global.i18n.translate('client_views_application_close_notice').fetch();
            }
        };

        // Keep tabs on the browser having focus
        this.has_focus = true;

        $(window).on('focus', function () {
            that.has_focus = true;
        });
        $(window).on('blur', function () {
            that.has_focus = false;
        });


        this.favicon = new _kiwi.view.Favicon();
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

        $('#kiwi .controlbox .inp').focus();
    },


    doLayout: function () {
        var el_kiwi = this.$el;
        var el_panels = this.elements.panels;
        var el_memberlists = this.elements.memberlists;
        var el_toolbar = this.elements.toolbar;
        var el_controlbox = this.elements.controlbox;
        var el_resize_handle = this.elements.resize_handle;

        if (!el_kiwi.is(':visible')) {
            return;
        }

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
            this.$el.find('.tabs', el_kiwi).css(css_heights);
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

        var input_wrap_width = parseInt($('#kiwi .controlbox .input_tools').outerWidth());
        el_controlbox.find('.input_wrap').css('right', input_wrap_width + 7);
    },


    alertWindow: function (title) {
        if (!this.alertWindowTimer) {
            this.alertWindowTimer = new (function () {
                var that = this;
                var tmr;
                var has_focus = true;
                var state = 0;
                var default_title = _kiwi.app.server_settings.client.window_title || 'Kiwi IRC';
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
            this.$el.find('.toolbar').slideUp({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
            $('#kiwi .controlbox').slideUp({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
        } else {
            this.$el.find('.toolbar').slideUp(0);
            $('#kiwi .controlbox').slideUp(0);
            this.doLayout();
        }
    },

    barsShow: function (instant) {
        var that = this;

        if (!instant) {
            this.$el.find('.toolbar').slideDown({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
            $('#kiwi .controlbox').slideDown({queue: false, duration: 400, step: $.proxy(this.doLayout, this)});
        } else {
            this.$el.find('.toolbar').slideDown(0);
            $('#kiwi .controlbox').slideDown(0);
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
    },


    showNotification: function(title, message) {
        var icon = this.model.get('base_path') + '/assets/img/ico.png';

        // Check if we have notification support
        if (!window.webkitNotifications)
            return;

        if (this.has_focus)
            return;

        if (webkitNotifications.checkPermission() === 0){
            window.webkitNotifications.createNotification(icon, title, message).show();
        }
    }
});

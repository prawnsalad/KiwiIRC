define('ui/application/view', function(require, exports, module) {

    var utils = require('helpers/utils');
    
    module.exports = Backbone.View.extend({
        initialize: function () {
            var that = this;

            this.$el = $($('#tmpl_application').html().trim());
            this.el = this.$el[0];

            $(this.model.get('container') || 'body').append(this.$el);

            this.elements = {
                panels:        this.$el.find('.panels'),
                right_bar:     this.$el.find('.right-bar'),
                toolbar:       this.$el.find('.toolbar'),
                controlbox:    this.$el.find('.controlbox'),
                resize_handle: this.$el.find('.memberlists-resize-handle')
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
                    return utils.translateText('client_views_application_close_notice');
                }
            };

            // Keep tabs on the browser having focus
            this.has_focus = true;

            $(window).on('focus', function windowOnFocus() {
                that.has_focus = true;
            });

            $(window).on('blur', function windowOnBlur() {
                var active_panel = that.model.panels().active;
                if (active_panel && active_panel.view.updateLastSeenMarker) {
                    active_panel.view.updateLastSeenMarker();
                }

                that.has_focus = false;
            });

            // If we get a touchstart event, make note of it so we know we're using a touchscreen
            $(window).on('touchstart', function windowOnTouchstart() {
                that.$el.addClass('touch');
                $(window).off('touchstart', windowOnTouchstart);
            });


            this.favicon = new (require('ui/favicon/'))();
            this.initSound();

            this.monitorPanelFallback();
        },



        updateTheme: function (theme_name) {
            // If called by the settings callback, get the correct new_value
            if (theme_name === _kiwi.global.settings) {
                theme_name = arguments[1];
            }

            // If we have no theme specified, get it from the settings
            if (!theme_name) theme_name = _kiwi.global.settings.get('theme') || 'relaxed';

            theme_name = theme_name.toLowerCase();

            // Clear any current theme
            $('[data-theme]:not([disabled])').each(function (idx, link) {
                var $link = $(link);
                $link.attr('disabled', true)[0].disabled = true;
            });

            // Apply the new theme
            var link = $('[data-theme][title=' + theme_name + ']');
            if (link.length > 0) {
                link.attr('disabled', false)[0].disabled = false;
            }

            this.doLayout();
        },


        reloadStyles: function() {
            var query_string = '?reload=' + new Date().getTime();
            $('link[rel="stylesheet"]').each(function() {
                this.href = this.href.replace(/\?.*|$/, query_string);
            });
        },


        setTabLayout: function (layout_style) {
            // If called by the settings callback, get the correct new_value
            if (layout_style === _kiwi.global.settings) {
                layout_style = arguments[1];
            }

            if (layout_style == 'list') {
                this.$el.addClass('chanlist-treeview');
            } else {
                this.$el.removeClass('chanlist-treeview');
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
            var elements = ['input', 'select', 'textarea', 'button', 'datalist', 'keygen'];
            var do_not_refocus =
                elements.indexOf(ev.target.tagName.toLowerCase()) > -1 ||
                $(ev.target).attr('contenteditable');
    
            if (do_not_refocus) {
                return;
            }

            $('#kiwi .controlbox .inp').focus();
        },


        doLayout: function () {
            var $kiwi = this.$el;
            var $panels = this.elements.panels;
            var $right_bar = this.elements.right_bar;
            var $toolbar = this.elements.toolbar;
            var $controlbox = this.elements.controlbox;
            var $resize_handle = this.elements.resize_handle;

            if (!$kiwi.is(':visible')) {
                return;
            }

            var css_heights = {
                top: $toolbar.outerHeight(true),
                bottom: $controlbox.outerHeight(true)
            };


            // If any elements are not visible, full size the panals instead
            if (!$toolbar.is(':visible')) {
                css_heights.top = 0;
            }

            if (!$controlbox.is(':visible')) {
                css_heights.bottom = 0;
            }

            // Apply the CSS sizes
            $panels.css(css_heights);
            $right_bar.css(css_heights);
            $resize_handle.css(css_heights);

            // If we have channel tabs on the side, adjust the height
            if ($kiwi.hasClass('chanlist-treeview')) {
                this.$el.find('.tabs', $kiwi).css(css_heights);
            }

            // Determine if we have a narrow window (mobile/tablet/or even small desktop window)
            if ($kiwi.outerWidth() < 700) {
                $kiwi.addClass('narrow');
                if (this.model.rightbar && this.model.rightbar.keep_hidden !== true)
                    this.model.rightbar.toggle(true);
            } else {
                $kiwi.removeClass('narrow');
                if (this.model.rightbar && this.model.rightbar.keep_hidden !== false)
                    this.model.rightbar.toggle(false);
            }

            // Set the panels width depending on the memberlist visibility
            if (!$right_bar.hasClass('disabled')) {
                // Panels to the side of the memberlist
                $panels.css('right', $right_bar.outerWidth(true));
                // The resize handle sits overlapping the panels and memberlist
                $resize_handle.css('left', $right_bar.position().left - ($resize_handle.outerWidth(true) / 2));
            } else {
                // Memberlist is hidden so panels to the right edge
                $panels.css('right', 0);
                // And move the handle just out of sight to the right
                $resize_handle.css('left', $panels.outerWidth(true));
            }

            var input_wrap_width = parseInt($controlbox.find('.input-tools').outerWidth(), 10);
            $controlbox.find('.input-wrap').css('right', input_wrap_width + 7);
        },


        alertWindow: function (title) {
            var app = this.model;

            if (!this.alertWindowTimer) {
                this.alertWindowTimer = new (function () {
                    var that = this;
                    var tmr;
                    var has_focus = true;
                    var state = 0;
                    var default_title = app.server_settings.client.window_title || 'Kiwi IRC';
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
                    preferFlash: false,

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
            var icon = this.model.get('base_path') + '/assets/img/ico.png',
                notifications = require('utils/notifications');

            if (!this.has_focus && notifications.allowed()) {
                notifications
                    .create(title, { icon: icon, body: message })
                    .closeAfter(5000)
                    .on('click', _.bind(window.focus, window));
            }
        },

        monitorPanelFallback: function() {
            var that = this,
                panel_access = [];

            this.model.panels.on('active', function() {
                var panel = that.model.panels().active,
                    panel_index;

                // If the panel is already open, remove it so we can put it back in first place
                panel_index = _.indexOf(panel_access, panel.cid);

                if (panel_index > -1) {
                    panel_access.splice(panel_index, 1);
                }

                //Make this panel the most recently accessed
                panel_access.unshift(panel.cid);
            });

            this.model.panels.on('remove', function(panel) {
                // If closing the active panel, switch to the last-accessed panel
                if (panel_access[0] === panel.cid) {
                    panel_access.shift();

                    //Get the last-accessed panel model now that we removed the closed one
                    var model = _.find(that.model.panels('applets').concat(that.model.panels('connections')), {cid: panel_access[0]});

                    if (model) {
                        model.view.show();
                    }
                }
            });
        }
    });
});

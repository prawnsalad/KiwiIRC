_kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        var that = this;

        $(window).resize(function() { that.doLayout.apply(that); });
        this.$el.find('.toolbar').resize(function() { that.doLayout.apply(that); });
        $('#kiwi .controlbox').resize(function() { that.doLayout.apply(that); });

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
        var el_panels = $('#kiwi .panels');
        var el_memberlists = $('#kiwi .memberlists');
        var el_toolbar = this.$el.find('.toolbar');
        var el_controlbox = $('#kiwi .controlbox');
        var el_resize_handle = $('#kiwi .memberlists_resize_handle');

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


    // This will have to be rewiritten to store highlights in kiwi, and not here
    notificationFavicon: function () {
        var base_path = this.model.get('base_path');

        this.favicon = new (function () {
            var that = this,
                hasFocus = true,
                highlightCount = 0,
                hasConvasSupport = !!window.CanvasRenderingContext2D,
                originalTitle = document.title,
                originalFaviconLink = $('link[rel~="icon"]')[0].href,
            	font = 'bold 10px Arial',
            	letterSpacing = -1.5;

            var ua = (function () {
                var agent = navigator.userAgent.toLowerCase();
                return function (browser) {
                    return agent.indexOf(browser) !== -1;
                };
            })();

            var browser = {
                ie: ua('msie'),
                chrome: ua('chrome'),
                webkit: ua('chrome') || ua('safari'),
                safari: ua('safari') && !ua('chrome'),
                mozilla: ua('mozilla') && !ua('chrome') && !ua('safari')
            };

            this.newHighlight = function () {
                if (!hasFocus) {
                    highlightCount++;
                    that._updateFavicon(highlightCount);
                }
            };

            this.resetHighlights = function () {
                highlightCount = 0;
                that._refreshFavicon(originalFaviconLink);
                that._setTitle();
            }

            this._updateFavicon = function (text) {
                text = text.toString();
                if (!hasConvasSupport || browser.ie || browser.safari) {
                    that._setTitle(text);
                }
                else {
                    that._drawFavicon(text);
                }
            };

            this._drawFavicon = function (text) {
                var context = that._createCanvas().getContext('2d'),
                    faviconImage = new Image();

                // Allow cross origin resource requests
                faviconImage.crossOrigin = 'anonymous';
                // Trigger the load event
                faviconImage.src = originalFaviconLink;

                // Wait for the favicon image to load
                faviconImage.onload = function () {
                    // Draw the favicon itself
                    context.drawImage(faviconImage, 0, 0, faviconImage.width, faviconImage.height);
                    // Add highlight bubble
                    that._drawBubble(context, text);
                    //Update
                    that._refreshFavicon(canvas.toDataURL());
                };
            };

            this._drawBubble = function (context, text) {
            	var textWidth = 0, textHidth = 0,
            		test = context,
            		canvasWidth = context.canvas.width,
            		canvasHeight = context.canvas.height;

            	// A hacky solution for letter-spacing, but works well with small favicon text
        	    CanvasRenderingContext2D.prototype.renderText = function (text, x, y, letterSpacing) {
					if (!text || typeof text !== 'string' || text.length === 0) {
					    return;
					}
					if (typeof letterSpacing === 'undefined') {
					    letterSpacing = 0;
					}
					// letterSpacing of 0 means normal letter-spacing
					var characters = String.prototype.split.call(text, ''),
					    index = 0,
					    current,
					    currentPosition = x,
					    align = 1;

					if (this.textAlign === 'right') {
					    characters = characters.reverse();
					    align = -1;
					} else if (this.textAlign === 'center') {
					    var totalWidth = 0;
					    for (var i = 0; i < characters.length; i++) {
					        totalWidth += (this.measureText(characters[i]).width + letterSpacing);
					    }
					    currentPosition = x - (totalWidth / 2);
					}

					while (index < text.length) {
					    current = characters[index++];
					    this.fillText(current, currentPosition, y);
					    currentPosition += (align * (this.measureText(current).width + letterSpacing));
					}
        	    }

                // Setup a test canvas to get text width
            	test.font = context.font = 'bold 10px Arial';
        		test.textAlign = 'right';
        		test.renderText(text, 0, 0, letterSpacing);

                // Calculate text width based on letter spacing and padding
                textWidth = test.measureText(text).width + letterSpacing * (text.length - 1) + 2;
        		textHeight = 8;

        		// Set bubble parameters
        		bubbleX = canvasWidth - textWidth;
        		bubbleY = canvasHeight - textHeight;

        		// Draw bubble background
        		context.fillStyle = 'red';
        		context.fillRect(bubbleX, bubbleY, textWidth, textHeight);

                // Draw the text
        		context.fillStyle = 'white';
        		context.renderText(text, canvasWidth - 1, canvasHeight - 1, letterSpacing);
            };

            this._refreshFavicon = function (url) {
                // Remove existing favicon since Firefox doesn't update fivacons on href change
                $('link[rel~="icon"]').remove();
                // Add new favicon
                $('<link rel="shortcut icon" href="' + url + '">').appendTo($('head'));
            };

            this._createCanvas = function () {
				canvas = document.createElement('canvas');
				canvas.width = 16;
				canvas.height = 16;

				return canvas;
			};

            this._setTitle = function (text) {
                if (text) {
                    document.title = '(' + text + ') ' + originalTitle;
                }
                else {
                    document.title = originalTitle;
                }
            };

            $(window).on('focus', function () {
                hasFocus = true;
                that.resetHighlights();
            });
            $(window).on('blur', function () {
                hasFocus = false;
            });
        })();
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
    }
});
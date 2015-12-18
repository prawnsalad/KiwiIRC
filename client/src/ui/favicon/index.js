define('ui/favicon/', function(require, exports, module) {
    module.exports = Backbone.View.extend({
        initialize: function () {
            var that = this,
                $win = $(window);

            this.has_focus = true;
            this.highlight_count = 0;
            // Check for html5 canvas support
            this.has_canvas_support = !!window.CanvasRenderingContext2D;

            // Store the original favicon
            this.original_favicon = $('link[rel~="icon"]')[0].href;

            // Create our favicon canvas
            this._createCanvas();

            // Reset favicon notifications when user focuses window
            $win.on('focus', function () {
                that.has_focus = true;
                that._resetHighlights();
            });
            $win.on('blur', function () {
                that.has_focus = false;
            });
        },

        newHighlight: function () {
            var that = this;
            if (!this.has_focus) {
                this.highlight_count++;
                if (this.has_canvas_support) {
                    this._drawFavicon(function() {
                        that._drawBubble(that.highlight_count.toString());
                        that._refreshFavicon(that.canvas.toDataURL());
                    });
                }
            }
        },

        _resetHighlights: function () {
            var that = this;
            this.highlight_count = 0;
            this._refreshFavicon(this.original_favicon);
        },

        _drawFavicon: function (callback) {
            var that = this,
                canvas = this.canvas,
                context = canvas.getContext('2d'),
                favicon_image = new Image();

            // Allow cross origin resource requests
            favicon_image.crossOrigin = 'anonymous';
            // Trigger the load event
            favicon_image.src = this.original_favicon;

            favicon_image.onload = function() {
                // Clear canvas from prevous iteration
                context.clearRect(0, 0, canvas.width, canvas.height);
                // Draw the favicon itself
                context.drawImage(favicon_image, 0, 0, canvas.width, canvas.height);
                callback();
            };
        },

        _drawBubble: function (label) {
            var letter_spacing,
                bubble_width = 0, bubble_height = 0,
                canvas = this.canvas,
                context = test_context = canvas.getContext('2d'),
                canvas_width = canvas.width,
                canvas_height = canvas.height;

            // Different letter spacing for MacOS
            if (navigator.appVersion.indexOf("Mac") !== -1) {
                letter_spacing = -1.5;
            }
            else {
                letter_spacing = -1;
            }

            // Setup a test canvas to get text width
            test_context.font = context.font = 'bold 10px Arial';
            test_context.textAlign = 'right';
            this._renderText(test_context, label, 0, 0, letter_spacing);

            // Calculate bubble width based on letter spacing and padding
            bubble_width = test_context.measureText(label).width + letter_spacing * (label.length - 1) + 2;
            // Canvas does not have any way of measuring text height, so we just do it manually and add 1px top/bottom padding
            bubble_height = 9;

            // Set bubble coordinates
            bubbleX = canvas_width - bubble_width;
            bubbleY = canvas_height - bubble_height;

            // Draw bubble background
            context.fillStyle = 'red';
            context.fillRect(bubbleX, bubbleY, bubble_width, bubble_height);

            // Draw the text
            context.fillStyle = 'white';
            this._renderText(context, label, canvas_width - 1, canvas_height - 1, letter_spacing);
        },

        _refreshFavicon: function (url) {
            $('link[rel~="icon"]').remove();
            $('<link rel="shortcut icon" href="' + url + '">').appendTo($('head'));
        },

        _createCanvas: function () {
            var canvas = document.createElement('canvas');
                canvas.width = 16;
                canvas.height = 16;

            this.canvas = canvas;
        },

        _renderText: function (context, text, x, y, letter_spacing) {
            // A hacky solution for letter-spacing, but works well with small favicon text
            // Modified from http://jsfiddle.net/davidhong/hKbJ4/
            var current,
                characters = text.split('').reverse(),
                index = 0,
                currentPosition = x;

            while (index < text.length) {
                current = characters[index++];
                context.fillText(current, currentPosition, y);
                currentPosition += (-1 * (context.measureText(current).width + letter_spacing));
            }

            return context;
        }
    });
});
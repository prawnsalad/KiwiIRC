_kiwi.view.Favicon = Backbone.View.extend({
    initialize: function () {
        var that = this,
            $win = $(window);

        this.has_focus = true;
        this.highlight_count = 0;

        this.original_favicon = $('link[rel~="icon"]')[0].href;

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
            this._drawFavicon(function(canvas) {
                var bubbleCanvas = that._drawBubble(that.highlight_count.toString(), canvas);
                that._refreshFavicon(bubbleCanvas.toDataURL());
            });
        }
    },

    _resetHighlights: function () {
        var that = this;
        this.highlight_count = 0;
        this._drawFavicon(function(canvas) {
            that._refreshFavicon(canvas.toDataURL());
        });
    },

    _drawFavicon: function (callback) {
        var that = this,
            context = this._createCanvas().getContext('2d'),
            favicon_image = new Image();

        // Allow cross origin resource requests
        favicon_image.crossOrigin = 'anonymous';
        // Trigger the load event
        favicon_image.src = this.original_favicon;

        favicon_image.onload = function() {
            // Draw the favicon itself
            context.drawImage(favicon_image, 0, 0, favicon_image.width, favicon_image.height);
            callback(canvas);
        };
    },

    _drawBubble: function (label, canvas) {
        var letter_spacing = -1.5,
            text_width = 0, text_height = 0,
            context = test = canvas.getContext('2d'),
            canvas_width = canvas.width,
            canvas_height = canvas.height;

        // A hacky solution for letter-spacing, but works well with small favicon text
        CanvasRenderingContext2D.prototype.renderText = function (text, x, y, letter_spacing) {
            if (!text || typeof text !== 'string' || text.length === 0) {
                return;
            }
            if (typeof letter_spacing === 'undefined') {
                letter_spacing = 0;
            }
            // letter_spacing of 0 means normal letter-spacing
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
                    totalWidth += (this.measureText(characters[i]).width + letter_spacing);
                }
                currentPosition = x - (totalWidth / 2);
            }

            while (index < text.length) {
                current = characters[index++];
                this.fillText(current, currentPosition, y);
                currentPosition += (align * (this.measureText(current).width + letter_spacing));
            }
        }

        // Setup a test canvas to get text width
        test.font = context.font = 'bold 10px Arial';
        test.textAlign = 'right';
        test.renderText(label, 0, 0, letter_spacing);

        // Calculate text width based on letter spacing and padding
        text_width = test.measureText(label).width + letter_spacing * (label.length - 1) + 2;
        text_height = 9;

        // Set bubble parameters
        bubbleX = canvas_width - text_width;
        bubbleY = canvas_height - text_height;

        // Draw bubble background
        context.fillStyle = 'red';
        context.fillRect(bubbleX, bubbleY, text_width, text_height);

        // Draw the text
        context.fillStyle = 'white';
        context.renderText(label, canvas_width - 1, canvas_height - 1, letter_spacing);

        return canvas;
    },

    _refreshFavicon: function (url) {
        $('link[rel~="icon"]').remove();
        $('<link rel="shortcut icon" href="' + url + '">').appendTo($('head'));
    },

    _createCanvas: function () {
        canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;

        return canvas;
    }
});
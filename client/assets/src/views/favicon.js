_kiwi.view.Favicon = Backbone.View.extend({
    initialize: function () {
        var that = this,
            $win = $(window);

        this.has_canvas_support = !!window.CanvasRenderingContext2D;
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
            if (this.has_canvas_support) {
                this._drawFavicon(function(canvas) {
                    var bubbleCanvas = that._drawBubble(that.highlight_count.toString(), canvas);
                    that._refreshFavicon(bubbleCanvas.toDataURL());
                });
            }
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

        // Setup a test canvas to get text width
        test.font = context.font = 'bold 10px Arial';
        test.textAlign = 'right';
        this._renderText(test, label, 0, 0, letter_spacing);

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
        this._renderText(context, label, canvas_width - 1, canvas_height - 1, letter_spacing);

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
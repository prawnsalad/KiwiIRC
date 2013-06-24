_kiwi.view.Favicon = Backbone.View.extend({
	initialize: function () {
		var that = this,
			$win = $(window);

	    this.hasFocus = true;
	    this.highlightCount = 0;

	    this.originalFavicon = $('link[rel~="icon"]')[0].href;

	    $win.on('focus', function () {
	        that.hasFocus = true;
	        that._resetHighlights();
	    });
	    $win.on('blur', function () {
	        that.hasFocus = false;
	    });
	},

	newHighlight: function () {
		var that = this;
	    if (!this.hasFocus) {
	        this.highlightCount++;
	        this._drawFavicon(function(canvas) {
	        	var bubbleCanvas = that._drawBubble(that.highlightCount.toString(), canvas);
	        	that._refreshFavicon(bubbleCanvas.toDataURL());
	        });
	    }
	},

	_resetHighlights: function () {
		var that = this;
	    this.highlightCount = 0;
	    this._drawFavicon(function(canvas) {
	    	that._refreshFavicon(canvas.toDataURL());
	    });
	},

	_drawFavicon: function (callback) {
	    var that = this,
	    	context = this._createCanvas().getContext('2d'),
	    	faviconImage = new Image();

	    // Allow cross origin resource requests
	    faviconImage.crossOrigin = 'anonymous';
	    // Trigger the load event
	    faviconImage.src = this.originalFavicon;

	    faviconImage.onload = function() {
	    	// Draw the favicon itself
	    	context.drawImage(faviconImage, 0, 0, faviconImage.width, faviconImage.height);
	    	callback(canvas);
	    };
	},

	_drawBubble: function (label, canvas) {
	    var letterSpacing = -1.5,
	    	textWidth = 0, textHidth = 0,
	    	context = test = canvas.getContext('2d'),
	        canvasWidth = canvas.width,
	        canvasHeight = canvas.height;

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
	    test.renderText(label, 0, 0, letterSpacing);

	    // Calculate text width based on letter spacing and padding
	    textWidth = test.measureText(label).width + letterSpacing * (label.length - 1) + 2;
	    textHeight = 9;

	    // Set bubble parameters
	    bubbleX = canvasWidth - textWidth;
	    bubbleY = canvasHeight - textHeight;

	    // Draw bubble background
	    context.fillStyle = 'red';
	    context.fillRect(bubbleX, bubbleY, textWidth, textHeight);

	    // Draw the text
	    context.fillStyle = 'white';
	    context.renderText(label, canvasWidth - 1, canvasHeight - 1, letterSpacing);

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
/*
	Orientation stuff
*/

var supportsOrientationChange = "onorientationchange" in window,
    orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

window.addEventListener(orientationEvent, function() {
    //alert('rotated' + window.orientation + " " + screen.width);
	var or = window.orientation;
	if(or == 90 || or == -90){
		// We have a landscape screen
		or = "landscape";
	} else {
		// We have a portrait screen
		or = "portrait";
	}
	
	if(agent == "ipad" || agent == "iphone" || agent == "ipod"){
		if(or == "landscape"){
			width = window.height;
			height = window.width;
		} else {
			width = window.width;
			height = window.height;
		}
	} else {
		width = window.width;
		height = window.height;
	}
	
	//alert('adding class: '+or);
	if(or=="landscape"){
		$('#kiwi').removeClass("portrait");
	} else {
		$('#kiwi').removeClass("landscape");
	}
	$('#kiwi').addClass(or);
}, false);









/*
	Scroll stuff
*/

function registerTouches(obj){
	return;
//$(document).ready(function(){
	obj.ontouchstart = function(e) {
		e.preventDefault();
		document.touchx_start = e.touches[0].pageX;
		document.touchy_start = e.touches[0].pageY;
	}
	obj.ontouchmove = function(e) {
		e.preventDefault();
		document.touchx_cur = e.touches[0].pageX;
		document.touchy_cur = e.touches[0].pageY;
		
		var xdiff = document.touchx_start - document.touchx_cur
		var ydiff = document.touchy_start - document.touchy_cur
		
		var obj = $(this);
		if(ydiff < -20){
			var n = obj.attr("scrollTop")+ydiff;
			//alert("down (xdiff="+xdiff+" ydiff="+ydiff+" scrollTop="+obj.attr("scrollTop")+") "+n );
			obj.attr("scrollTop", n);
		} else if(ydiff > 20){
			var n = obj.attr("scrollTop")+ydiff;
			//alert("up (xdiff="+xdiff+" ydiff="+ydiff+" scrollTop="+obj.attr("scrollTop")+") "+n);
			obj.attr("scrollTop", n);
		}
	}
	obj.ontouchend = function(e) {
		e.preventDefault();
		
		var xdiff = document.touchx_start - document.touchx_cur
		var ydiff = document.touchy_start - document.touchy_cur
		//alert('x='+xdiff+'   y='+ydiff);
		//alert('Start: x='+document.touchx+'   y='+document.touchy+"\n"+'End: x='+e.pageX+'   y='+e.pageY);
		
		if(xdiff < -150 && (ydiff > -250 && ydiff < 250)){
			//alert("next window (xdiff="+xdiff+" ydiff="+ydiff+")");
			front.tabviewsNext();
		} else if(xdiff > 150 && (ydiff > -250 && ydiff < 250)){
			//alert("previous window (xdiff="+xdiff+" ydiff="+ydiff+")");
			front.tabviewsPrevious();
		}
	}
//});
}


















/*
 * jSwipe - jQuery Plugin
 * http://plugins.jquery.com/project/swipe
 * http://www.ryanscherf.com/demos/swipe/
 *
 * Copyright (c) 2009 Ryan Scherf (www.ryanscherf.com)
 * Licensed under the MIT license
 *
 * $Date: 2009-07-14 (Tue, 14 Jul 2009) $
 * $version: 0.1.2
 * 
 * This jQuery plugin will only run on devices running Mobile Safari
 * on iPhone or iPod Touch devices running iPhone OS 2.0 or later. 
 * http://developer.apple.com/iphone/library/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
 */
(function($) {
	$.fn.swipe = function(options) {
		
		// Default thresholds & swipe functions
		var defaults = {
			threshold: {
				x: 30,
				y: 10
			},
			swipeLeft: function() {  },
			swipeRight: function() {  }
		};
		
		var options = $.extend(defaults, options);
		
		if (!this) return false;
		
		return this.each(function() {
			
			var me = $(this)
			
			// Private variables for each element
			var originalCoord = { x: 0, y: 0 }
			var finalCoord = { x: 0, y: 0 }
			
			// Screen touched, store the original coordinate
			function touchStart(event) {
				//console.log('Starting swipe gesture...')
				originalCoord.x = event.targetTouches[0].pageX
				originalCoord.y = event.targetTouches[0].pageY
			}
			
			// Store coordinates as finger is swiping
			function touchMove(event) {
			    //event.preventDefault();
				finalCoord.x = event.targetTouches[0].pageX // Updated X,Y coordinates
				finalCoord.y = event.targetTouches[0].pageY
			}
			
			// Done Swiping
			// Swipe should only be on X axis, ignore if swipe on Y axis
			// Calculate if the swipe was left or right
			function touchEnd(event) {
				//console.log('Ending swipe gesture...')
				var changeY = originalCoord.y - finalCoord.y
				if(changeY < defaults.threshold.y && changeY > (defaults.threshold.y*-1)) {
					changeX = originalCoord.x - finalCoord.x
					
					if(changeX > defaults.threshold.x) {
						defaults.swipeLeft()
					}
					if(changeX < (defaults.threshold.x*-1)) {
						defaults.swipeRight()
					}
				}
			}
			
			// Swipe was started
			function touchStart(event) {
				//console.log('Starting swipe gesture...')
				originalCoord.x = event.targetTouches[0].pageX
				originalCoord.y = event.targetTouches[0].pageY

				finalCoord.x = originalCoord.x
				finalCoord.y = originalCoord.y
			}
			
			// Swipe was canceled
			function touchCancel(event) { 
				//console.log('Canceling swipe gesture...')
			}
			
			// Add gestures to all swipable areas
			this.addEventListener("touchstart", touchStart, false);
			this.addEventListener("touchmove", touchMove, false);
			this.addEventListener("touchend", touchEnd, false);
			this.addEventListener("touchcancel", touchCancel, false);
				
		});
	};
})(jQuery);

$(document).swipe({
	swipeLeft: function(){ front.windowsNext(); },
	swipeRight: function(){ front.windowsPrevious(); },
	threshold: {x: 30, y: 20}
});
/*
	Orientation stuff
*/
/*
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
*/








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
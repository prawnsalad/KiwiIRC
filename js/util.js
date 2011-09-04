function manageDebug(debug){  
    if(window.console){  
        var consoleBackUp = window.console.log;  
        window.console.log = function(str){  
            if(debug){  
                consoleBackUp.call(this,str);  
            }  
        }  
    }else{  
        var log = window.opera ? window.opera.postError : alert;  
        window.console = {};  
        window.console.log = function(str){  
            if(debug){  
                log(str);  
            }  
        }  
    }  
}


function randomString(string_length) {
	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	return randomstring;
}

String.prototype.trim = function() {
  return this.replace(/^\s+|\s+$/g, "");
};

String.prototype.lpad = function(length, character){
	var padding = "";
	for(var i=0; i<length; i++) padding += character;
	return (padding + this).slice (-length)
};



/*
	PLUGINS
	Each function in each object is looped through and ran. The resulting text
	is expected to be returned.
*/
var plugins = [
	{
		name: "images",
		onaddmsg: function(event, opts){
			if( !event.msg ) return event;

			event.msg = event.msg.replace(/^((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?(\.jpg|\.jpeg|\.gif|\.bmp|\.png)$/gi,function(url){
				// Don't let any future plugins change it (ie. html_safe plugins)
				event.event_bubbles = false;

				var img = '<img class="link_img_a" src="'+url+'" height="100%" width="100%" />';
				return '<a class="link_ext link_img" target="_blank" rel="nofollow" href="'+ url +'" style="height:50px;width:50px;display:block">'+ img +'<div class="tt box"></div></a>';
			});
			
			return event;
		}
	},

	{
		name: "html_safe",
		onaddmsg: function(event, opts){
			event.msg = $('<div/>').text(event.msg).html();
			event.nick = $('<div/>').text(event.nick).html();

			return event;
		}
	},

	{
		name: "activity",
		onaddmsg: function(event, opts){
			if(front.cur_channel.name.toLowerCase() != front.tabviews[event.tabview.toLowerCase()].name){
				front.tabviews[event.tabview].activity();
			}

			return event;
		}
	},
	
	{
		name: "highlight",
		onaddmsg: function(event, opts){
			if(event.msg.toLowerCase().indexOf(gateway.nick.toLowerCase()) > -1){
				if(front.cur_channel.name.toLowerCase() != front.tabviews[event.tabview.toLowerCase()].name){
					front.tabviews[event.tabview].highlight();
				}
				if(front.isChannel(front.tabviews[event.tabview].name)){
					event.msg = '<span style="color:red;">'+event.msg+'</span>';
				}
			}
			
			if(
				!front.isChannel(front.tabviews[event.tabview].name) && front.tabviews[event.tabview].name != "server"
				&& front.cur_channel.name.toLowerCase() != front.tabviews[event.tabview.toLowerCase()].name
			){
				front.tabviews[event.tabview].highlight();
			}

			return event;
		}
	},	
	
	
	
	{
		//Following method taken from: http://snipplr.com/view/13533/convert-text-urls-into-links/
		name: "linkify_plain",
		onaddmsg: function(event, opts){
			if( !event.msg ) return event;
			
			event.msg = event.msg.replace(/((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/gi,function(url){
				// If it's any of the supported images in the images plugin, skip it
				if(url.match('(\.jpg|\.jpeg|\.gif|\.bmp|\.png)$')) return url;

				nice = url;
				if(url.match('^https?:\/\/')){
					//nice = nice.replace(/^https?:\/\//i,'')
				} else {
					url = 'http://'+url;
				}
				
				return '<a class="link_ext" target="_blank" rel="nofollow" href="'+ url +'">'+ nice +'<div class="tt box"></div></a>';
			});
			
			return event;
		}
	},

    {
		name: "lftobr",
		onaddmsg: function(event, opts){
			if( !event.msg ) return event;
			
			event.msg = event.msg.replace(/\n/gi,function(txt){
				return '<br/>';
			});
			
			return event;
		}
	},


	{
		name: "inBrowser",
		oninit: function(event, opts){
	        $('#windows a.link_ext').live('mouseover', this.mouseover);
	        $('#windows a.link_ext').live('mouseout', this.mouseout);
	        $('#windows a.link_ext').live('click', this.mouseclick);
		},

		onunload: function(event, opts){
			// TODO: make this work
			$('#windows a.link_ext').die('mouseover', this.mouseover);
			$('#windows a.link_ext').die('mouseout', this.mouseout);
			$('#windows a.link_ext').die('click', this.mouseclick);
		},



		mouseover: function(e){
            var a = $(this);
            var tt = $('.tt', a);

            if (tt.text() === '') {
                var tooltip = $('<a class="link_ext_browser">Open in Kiwi..</a>');
                tt.append(tooltip);
            }

            tt.css('top', -tt.outerHeight()+'px');
            tt.css('left', (a.outerWidth() / 2) - (tt.outerWidth() / 2));
		},

		mouseout: function(e){
            var a = $(this);
            var tt = $('.tt', a);
		},

		mouseclick: function(e){
            var a = $(this);
            
            switch (e.target.className) {
            case 'link_ext':
            case 'link_img_a':
                return true;
                break;
            case 'link_ext_browser':
                var t = new Utilityview('Browser');
                t.topic = a.attr('href');

				t.iframe = $('<iframe border="0" class="utility_view" src="" style="width:100%;height:100%;border:none;"></iframe>');
			    t.iframe.attr('src', a.attr('href'));
			    t.div.append(t.iframe);
                t.show();
                break;
            }
            return false;
		}
	}
];









plugs = {};
plugs.loaded = {};
plugs.loadPlugin = function (plugin) {
	if (typeof plugin.name !== 'string') return false;

	var plugin_ret = plugs.run('plugin_load', {plugin: plugin});
    if (typeof plugin_ret === 'object') plugs.loaded[plugin_ret.plugin.name] = plugin_ret.plugin;
    plugs.run('init', {}, {run_only: plugin_ret.plugin.name});

    return true;
};

plugs.unloadPlugin = function (plugin_name) {
	if (typeof plugs.loaded[plugin_name] !== 'object') return;

	plugs.run('unload', {}, {run_only: plugin_name});
	delete plugs.loaded[plugin_name];
}



/*
 * Run an event against all loaded plugins
 */
plugs.run = function (event_name, event_data, opts) {
    var ret = event_data,
        ret_tmp, plugin_name;
    
    // Set some defaults if not provided
    event_data = (typeof event_data === 'undefined') ? {} : event_data;
    opts = (typeof opts === 'undefined') ? {} : opts;
    
    for (plugin_name in plugs.loaded) {
    	// If we're only calling 1 plugin, make sure it's that one
    	if (typeof opts.run_only === 'string' && opts.run_only !== plugin_name) continue;

        if (typeof plugs.loaded[plugin_name]['on' + event_name] === 'function') {
            try {
                ret_tmp = plugs.loaded[plugin_name]['on' + event_name](ret, opts);
                if (ret_tmp === null) {
                    return null;
                }
                ret = ret_tmp;
               	
                if (typeof ret.event_bubbles === 'boolean' && ret.event_bubbles === false){
                	delete ret.event_bubbles;
                	return ret;
                }
            } catch (e) {
            }
        }
    }

    return ret;
};


for(var i in plugins) plugs.loadPlugin(plugins[i]);








/*
 * jQuery Templates Plugin 1.0.0pre
 * http://github.com/jquery/jquery-tmpl
 * Requires jQuery 1.4.2
 *
 * Copyright Software Freedom Conservancy, Inc.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 */
(function(a){var r=a.fn.domManip,d="_tmplitem",q=/^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,b={},f={},e,p={key:0,data:{}},i=0,c=0,l=[];function g(g,d,h,e){var c={data:e||(e===0||e===false)?e:d?d.data:{},_wrap:d?d._wrap:null,tmpl:null,parent:d||null,nodes:[],calls:u,nest:w,wrap:x,html:v,update:t};g&&a.extend(c,g,{nodes:[],parent:d});if(h){c.tmpl=h;c._ctnt=c._ctnt||c.tmpl(a,c);c.key=++i;(l.length?f:b)[i]=c}return c}a.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(f,d){a.fn[f]=function(n){var g=[],i=a(n),k,h,m,l,j=this.length===1&&this[0].parentNode;e=b||{};if(j&&j.nodeType===11&&j.childNodes.length===1&&i.length===1){i[d](this[0]);g=this}else{for(h=0,m=i.length;h<m;h++){c=h;k=(h>0?this.clone(true):this).get();a(i[h])[d](k);g=g.concat(k)}c=0;g=this.pushStack(g,f,i.selector)}l=e;e=null;a.tmpl.complete(l);return g}});a.fn.extend({tmpl:function(d,c,b){return a.tmpl(this[0],d,c,b)},tmplItem:function(){return a.tmplItem(this[0])},template:function(b){return a.template(b,this[0])},domManip:function(d,m,k){if(d[0]&&a.isArray(d[0])){var g=a.makeArray(arguments),h=d[0],j=h.length,i=0,f;while(i<j&&!(f=a.data(h[i++],"tmplItem")));if(f&&c)g[2]=function(b){a.tmpl.afterManip(this,b,k)};r.apply(this,g)}else r.apply(this,arguments);c=0;!e&&a.tmpl.complete(b);return this}});a.extend({tmpl:function(d,h,e,c){var i,k=!c;if(k){c=p;d=a.template[d]||a.template(null,d);f={}}else if(!d){d=c.tmpl;b[c.key]=c;c.nodes=[];c.wrapped&&n(c,c.wrapped);return a(j(c,null,c.tmpl(a,c)))}if(!d)return[];if(typeof h==="function")h=h.call(c||{});e&&e.wrapped&&n(e,e.wrapped);i=a.isArray(h)?a.map(h,function(a){return a?g(e,c,d,a):null}):[g(e,c,d,h)];return k?a(j(c,null,i)):i},tmplItem:function(b){var c;if(b instanceof a)b=b[0];while(b&&b.nodeType===1&&!(c=a.data(b,"tmplItem"))&&(b=b.parentNode));return c||p},template:function(c,b){if(b){if(typeof b==="string")b=o(b);else if(b instanceof a)b=b[0]||{};if(b.nodeType)b=a.data(b,"tmpl")||a.data(b,"tmpl",o(b.innerHTML));return typeof c==="string"?(a.template[c]=b):b}return c?typeof c!=="string"?a.template(null,c):a.template[c]||a.template(null,q.test(c)?c:a(c)):null},encode:function(a){return(""+a).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;")}});a.extend(a.tmpl,{tag:{tmpl:{_default:{$2:"null"},open:"if($notnull_1){__=__.concat($item.nest($1,$2));}"},wrap:{_default:{$2:"null"},open:"$item.calls(__,$1,$2);__=[];",close:"call=$item.calls();__=call._.concat($item.wrap(call,__));"},each:{_default:{$2:"$index, $value"},open:"if($notnull_1){$.each($1a,function($2){with(this){",close:"}});}"},"if":{open:"if(($notnull_1) && $1a){",close:"}"},"else":{_default:{$1:"true"},open:"}else if(($notnull_1) && $1a){"},html:{open:"if($notnull_1){__.push($1a);}"},"=":{_default:{$1:"$data"},open:"if($notnull_1){__.push($.encode($1a));}"},"!":{open:""}},complete:function(){b={}},afterManip:function(f,b,d){var e=b.nodeType===11?a.makeArray(b.childNodes):b.nodeType===1?[b]:[];d.call(f,b);m(e);c++}});function j(e,g,f){var b,c=f?a.map(f,function(a){return typeof a==="string"?e.key?a.replace(/(<\w+)(?=[\s>])(?![^>]*_tmplitem)([^>]*)/g,"$1 "+d+'="'+e.key+'" $2'):a:j(a,e,a._ctnt)}):e;if(g)return c;c=c.join("");c.replace(/^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/,function(f,c,e,d){b=a(e).get();m(b);if(c)b=k(c).concat(b);if(d)b=b.concat(k(d))});return b?b:k(c)}function k(c){var b=document.createElement("div");b.innerHTML=c;return a.makeArray(b.childNodes)}function o(b){return new Function("jQuery","$item","var $=jQuery,call,__=[],$data=$item.data;with($data){__.push('"+a.trim(b).replace(/([\\'])/g,"\\$1").replace(/[\r\t\n]/g," ").replace(/\$\{([^\}]*)\}/g,"{{= $1}}").replace(/\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}\}/g,function(m,l,k,g,b,c,d){var j=a.tmpl.tag[k],i,e,f;if(!j)throw"Unknown template tag: "+k;i=j._default||[];if(c&&!/\w$/.test(b)){b+=c;c=""}if(b){b=h(b);d=d?","+h(d)+")":c?")":"";e=c?b.indexOf(".")>-1?b+h(c):"("+b+").call($item"+d:b;f=c?e:"(typeof("+b+")==='function'?("+b+").call($item):("+b+"))"}else f=e=i.$1||"null";g=h(g);return"');"+j[l?"close":"open"].split("$notnull_1").join(b?"typeof("+b+")!=='undefined' && ("+b+")!=null":"true").split("$1a").join(f).split("$1").join(e).split("$2").join(g||i.$2||"")+"__.push('"})+"');}return __;")}function n(c,b){c._wrap=j(c,true,a.isArray(b)?b:[q.test(b)?b:a(b).html()]).join("")}function h(a){return a?a.replace(/\\'/g,"'").replace(/\\\\/g,"\\"):null}function s(b){var a=document.createElement("div");a.appendChild(b.cloneNode(true));return a.innerHTML}function m(o){var n="_"+c,k,j,l={},e,p,h;for(e=0,p=o.length;e<p;e++){if((k=o[e]).nodeType!==1)continue;j=k.getElementsByTagName("*");for(h=j.length-1;h>=0;h--)m(j[h]);m(k)}function m(j){var p,h=j,k,e,m;if(m=j.getAttribute(d)){while(h.parentNode&&(h=h.parentNode).nodeType===1&&!(p=h.getAttribute(d)));if(p!==m){h=h.parentNode?h.nodeType===11?0:h.getAttribute(d)||0:0;if(!(e=b[m])){e=f[m];e=g(e,b[h]||f[h]);e.key=++i;b[i]=e}c&&o(m)}j.removeAttribute(d)}else if(c&&(e=a.data(j,"tmplItem"))){o(e.key);b[e.key]=e;h=a.data(j.parentNode,"tmplItem");h=h?h.key:0}if(e){k=e;while(k&&k.key!=h){k.nodes.push(j);k=k.parent}delete e._ctnt;delete e._wrap;a.data(j,"tmplItem",e)}function o(a){a=a+n;e=l[a]=l[a]||g(e,b[e.parent.key+n]||e.parent)}}}function u(a,d,c,b){if(!a)return l.pop();l.push({_:a,tmpl:d,item:this,data:c,options:b})}function w(d,c,b){return a.tmpl(a.template(d),c,b,this)}function x(b,d){var c=b.options||{};c.wrapped=d;return a.tmpl(a.template(b.tmpl),b.data,c,b.item)}function v(d,c){var b=this._wrap;return a.map(a(a.isArray(b)?b.join(""):b).filter(d||"*"),function(a){return c?a.innerText||a.textContent:a.outerHTML||s(a)})}function t(){var b=this.nodes;a.tmpl(null,null,null,this).insertBefore(b[0]);a(b).remove()}})(jQuery);

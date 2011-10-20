/*jslint devel: true, browser: true, continue: true, sloppy: true, forin: true, plusplus: true, maxerr: 50, indent: 4, nomen: true, regexp: true*/
/*globals $, front, gateway, Utilityview */

// Holds anything kiwi client specific (ie. front, gateway, kiwi.plugs..)
/**
*   @namespace
*/
var kiwi = {};



/**
*   Suppresses console.log
*   @param  {Boolean}   debug   Whether to re-enable console.log or not
*/
function manageDebug(debug) {
    var log, consoleBackUp;
    if (window.console) {
        consoleBackUp = window.console.log;
        window.console.log = function () {
            if (debug) {
                consoleBackUp.apply(console, arguments);
            }
        };
    } else {
        log = window.opera ? window.opera.postError : alert;
        window.console = {};
        window.console.log = function (str) {
            if (debug) {
                log(str);
            }
        };
    }
}

/**
*   Generate a random string of given length
*   @param      {Number}    string_length   The length of the random string
*   @returns    {String}                    The random string
*/
function randomString(string_length) {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",
        randomstring = '',
        i,
        rnum;
    for (i = 0; i < string_length; i++) {
        rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum, rnum + 1);
    }
    return randomstring;
}

/**
*   String.trim shim
*/
if (typeof String.prototype.trim === 'undefined') {
    String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, "");
    };
}

/**
*   String.lpad shim
*   @param      {Number}    length      The length of padding
*   @param      {String}    characher   The character to pad with
*   @returns    {String}                The padded string
*/
if (typeof String.prototype.lpad === 'undefined') {
    String.prototype.lpad = function (length, character) {
        var padding = "",
            i;
        for (i = 0; i < length; i++) {
            padding += character;
        }
        return (padding + this).slice(-length);
    };
}


/**
*   Convert seconds into hours:minutes:seconds
*   @param      {Number}    secs    The number of seconds to converts
*   @returns    {Object}            An object representing the hours/minutes/second conversion of secs
*/
function secondsToTime(secs) {
    var hours, minutes, seconds, divisor_for_minutes, divisor_for_seconds, obj;
    hours = Math.floor(secs / (60 * 60));

    divisor_for_minutes = secs % (60 * 60);
    minutes = Math.floor(divisor_for_minutes / 60);

    divisor_for_seconds = divisor_for_minutes % 60;
    seconds = Math.ceil(divisor_for_seconds);

    obj = {
        "h": hours,
        "m": minutes,
        "s": seconds
    };
    return obj;
}


/*
    PLUGINS
    Each function in each object is looped through and ran. The resulting text
    is expected to be returned.
*/
var plugins = [
    {
        name: "images",
        onaddmsg: function (event, opts) {
            if (!event.msg) {
                return event;
            }

            event.msg = event.msg.replace(/^((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?(\.jpg|\.jpeg|\.gif|\.bmp|\.png)$/gi, function (url) {
                // Don't let any future plugins change it (ie. html_safe plugins)
                event.event_bubbles = false;

                var img = '<img class="link_img_a" src="' + url + '" height="100%" width="100%" />';
                return '<a class="link_ext link_img" target="_blank" rel="nofollow" href="' + url + '" style="height:50px;width:50px;display:block">' + img + '<div class="tt box"></div></a>';
            });

            return event;
        }
    },

    {
        name: "html_safe",
        onaddmsg: function (event, opts) {
            event.msg = $('<div/>').text(event.msg).html();
            event.nick = $('<div/>').text(event.nick).html();

            return event;
        }
    },

    {
        name: "activity",
        onaddmsg: function (event, opts) {
            if (kiwi.front.cur_channel.name.toLowerCase() !== kiwi.front.tabviews[event.tabview.toLowerCase()].name) {
                kiwi.front.tabviews[event.tabview].activity();
            }

            return event;
        }
    },

    {
        name: "highlight",
        onaddmsg: function (event, opts) {
            var tab = Tabviews.getTab(event.tabview.toLowerCase());

            // If we have a highlight...
            if (event.msg.toLowerCase().indexOf(kiwi.gateway.nick.toLowerCase()) > -1) {
                if (Tabview.getCurrentTab() !== tab) {
                    tab.highlight();
                }
                if (kiwi.front.isChannel(tab.name)) {
                    event.msg = '<span style="color:red;">' + event.msg + '</span>';
                }
            }

            // If it's a PM, highlight
            if (!kiwi.front.isChannel(tab.name) && tab.name !== "server"
                && Tabview.getCurrentTab().name.toLowerCase() !== tab.name
            ) {
                tab.highlight();
            }

            return event;
        }
    },



    {
        //Following method taken from: http://snipplr.com/view/13533/convert-text-urls-into-links/
        name: "linkify_plain",
        onaddmsg: function (event, opts) {
            if (!event.msg) {
                return event;
            }

            event.msg = event.msg.replace(/((https?\:\/\/|ftp\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/gi, function (url) {
                var nice;
                // If it's any of the supported images in the images plugin, skip it
                if (url.match(/(\.jpg|\.jpeg|\.gif|\.bmp|\.png)$/)) {
                    return url;
                }

                nice = url;
                if (url.match('^https?:\/\/')) {
                    //nice = nice.replace(/^https?:\/\//i,'')
                    nice = url; // Shutting up JSLint...
                } else {
                    url = 'http://' + url;
                }

                //return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '<div class="tt box"></div></a>';
                return '<a class="link_ext" target="_blank" rel="nofollow" href="' + url + '">' + nice + '</a>';
            });

            return event;
        }
    },

    {
        name: "lftobr",
        onaddmsg: function (event, opts) {
            if (!event.msg) {
                return event;
            }

            event.msg = event.msg.replace(/\n/gi, function (txt) {
                return '<br/>';
            });

            return event;
        }
    },


    /*
     * Disabled due to many websites closing kiwi with iframe busting
    {
        name: "inBrowser",
        oninit: function (event, opts) {
            $('#windows a.link_ext').live('mouseover', this.mouseover);
            $('#windows a.link_ext').live('mouseout', this.mouseout);
            $('#windows a.link_ext').live('click', this.mouseclick);
        },

        onunload: function (event, opts) {
            // TODO: make this work (remove all .link_ext_browser as created in mouseover())
            $('#windows a.link_ext').die('mouseover', this.mouseover);
            $('#windows a.link_ext').die('mouseout', this.mouseout);
            $('#windows a.link_ext').die('click', this.mouseclick);
        },



        mouseover: function (e) {
            var a = $(this),
                tt = $('.tt', a),
                tooltip;

            if (tt.text() === '') {
                tooltip = $('<a class="link_ext_browser">Open in Kiwi..</a>');
                tt.append(tooltip);
            }

            tt.css('top', -tt.outerHeight() + 'px');
            tt.css('left', (a.outerWidth() / 2) - (tt.outerWidth() / 2));
        },

        mouseout: function (e) {
            var a = $(this),
                tt = $('.tt', a);
        },

        mouseclick: function (e) {
            var a = $(this),
                t;

            switch (e.target.className) {
            case 'link_ext':
            case 'link_img_a':
                return true;
                //break;
            case 'link_ext_browser':
                t = new Utilityview('Browser');
                t.topic = a.attr('href');

                t.iframe = $('<iframe border="0" class="utility_view" src="" style="width:100%;height:100%;border:none;"></iframe>');
                t.iframe.attr('src', a.attr('href'));
                t.div.append(t.iframe);
                t.show();
                break;
            }
            return false;

		}
	},
    */

    {
        name: "nick_colour",
        onaddmsg: function (event, opts) {
            if (!event.msg) {
                return event;
            }

            if (typeof kiwi.front.tabviews[event.tabview].nick_colours === 'undefined') {
                kiwi.front.tabviews[event.tabview].nick_colours = {};
            }

            if (typeof kiwi.front.tabviews[event.tabview].nick_colours[event.nick] === 'undefined') {
                kiwi.front.tabviews[event.tabview].nick_colours[event.nick] = this.randColour();
            }

            var c = kiwi.front.tabviews[event.tabview].nick_colours[event.nick];
            event.nick = '<span style="color:' + c + ';">' + event.nick + '</span>';

            return event;
        },



        randColour: function () {
            var h = this.rand(-250, 0),
                s = this.rand(30, 100),
                l = this.rand(20, 70);
            return 'hsl(' + h + ',' + s + '%,' + l + '%)';
        },


        rand: function (min, max) {
            return parseInt(Math.random() * (max - min + 1), 10) + min;
        }
    },

	{
		name: "kiwitest",
		oninit: function (event, opts) {
			console.log('registering namespace');
			$(gateway).bind("kiwi.lol.browser", function (e, data) {
				console.log('YAY kiwitest');
				console.log(data);
			});
		}
	}
];







/**
*   @namespace
*/
kiwi.plugs = {};
/**
*   Loaded plugins
*/
kiwi.plugs.loaded = {};
/**
*   Load a plugin
*   @param      {Object}    plugin  The plugin to be loaded
*   @returns    {Boolean}           True on success, false on failure
*/
kiwi.plugs.loadPlugin = function (plugin) {
    var plugin_ret;
    if (typeof plugin.name !== 'string') {
        return false;
    }

    plugin_ret = kiwi.plugs.run('plugin_load', {plugin: plugin});
    if (typeof plugin_ret === 'object') {
        kiwi.plugs.loaded[plugin_ret.plugin.name] = plugin_ret.plugin;
        kiwi.plugs.loaded[plugin_ret.plugin.name].local_data = new kiwi.dataStore('kiwi_plugin_' + plugin_ret.plugin.name);
    }
    kiwi.plugs.run('init', {}, {run_only: plugin_ret.plugin.name});

    return true;
};

/**
*   Unload a plugin
*   @param  {String}    plugin_name The name of the plugin to unload
*/
kiwi.plugs.unloadPlugin = function (plugin_name) {
    if (typeof kiwi.plugs.loaded[plugin_name] !== 'object') {
        return;
    }

    kiwi.plugs.run('unload', {}, {run_only: plugin_name});
    delete kiwi.plugs.loaded[plugin_name];
};



/**
*   Run an event against all loaded plugins
*   @param      {String}    event_name  The name of the event
*   @param      {Object}    event_data  The data to pass to the plugin
*   @param      {Object}    opts        Options
*   @returns    {Object}                Event data, possibly modified by the plugins
*/
kiwi.plugs.run = function (event_name, event_data, opts) {
    var ret = event_data,
        ret_tmp,
        plugin_name;

    // Set some defaults if not provided
    event_data = (typeof event_data === 'undefined') ? {} : event_data;
    opts = (typeof opts === 'undefined') ? {} : opts;

    for (plugin_name in kiwi.plugs.loaded) {
        // If we're only calling 1 plugin, make sure it's that one
        if (typeof opts.run_only === 'string' && opts.run_only !== plugin_name) {
            continue;
        }

        if (typeof kiwi.plugs.loaded[plugin_name]['on' + event_name] === 'function') {
            try {
                ret_tmp = kiwi.plugs.loaded[plugin_name]['on' + event_name](ret, opts);
                if (ret_tmp === null) {
                    return null;
                }
                ret = ret_tmp;

                if (typeof ret.event_bubbles === 'boolean' && ret.event_bubbles === false) {
                    delete ret.event_bubbles;
                    return ret;
                }
            } catch (e) {
            }
        }
    }

    return ret;
};



/**
*   @constructor
*   @param  {String}    data_namespace  The namespace for the data store
*/
kiwi.dataStore = function (data_namespace) {
    var namespace = data_namespace;

    this.get = function (key) {
        return $.jStorage.get(data_namespace + '_' + key);
    };

    this.set = function (key, value) {
        return $.jStorage.set(data_namespace + '_' + key, value);
    };
};

kiwi.data = new kiwi.dataStore('kiwi');




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


/*
 * jQuery jStorage plugin 
 * https://github.com/andris9/jStorage/
 */
(function(f){if(!f||!(f.toJSON||Object.toJSON||window.JSON)){throw new Error("jQuery, MooTools or Prototype needs to be loaded before jStorage!")}var g={},d={jStorage:"{}"},h=null,j=0,l=f.toJSON||Object.toJSON||(window.JSON&&(JSON.encode||JSON.stringify)),e=f.evalJSON||(window.JSON&&(JSON.decode||JSON.parse))||function(m){return String(m).evalJSON()},i=false;_XMLService={isXML:function(n){var m=(n?n.ownerDocument||n:0).documentElement;return m?m.nodeName!=="HTML":false},encode:function(n){if(!this.isXML(n)){return false}try{return new XMLSerializer().serializeToString(n)}catch(m){try{return n.xml}catch(o){}}return false},decode:function(n){var m=("DOMParser" in window&&(new DOMParser()).parseFromString)||(window.ActiveXObject&&function(p){var q=new ActiveXObject("Microsoft.XMLDOM");q.async="false";q.loadXML(p);return q}),o;if(!m){return false}o=m.call("DOMParser" in window&&(new DOMParser())||window,n,"text/xml");return this.isXML(o)?o:false}};function k(){if("localStorage" in window){try{if(window.localStorage){d=window.localStorage;i="localStorage"}}catch(p){}}else{if("globalStorage" in window){try{if(window.globalStorage){d=window.globalStorage[window.location.hostname];i="globalStorage"}}catch(o){}}else{h=document.createElement("link");if(h.addBehavior){h.style.behavior="url(#default#userData)";document.getElementsByTagName("head")[0].appendChild(h);h.load("jStorage");var n="{}";try{n=h.getAttribute("jStorage")}catch(m){}d.jStorage=n;i="userDataBehavior"}else{h=null;return}}}b()}function b(){if(d.jStorage){try{g=e(String(d.jStorage))}catch(m){d.jStorage="{}"}}else{d.jStorage="{}"}j=d.jStorage?String(d.jStorage).length:0}function c(){try{d.jStorage=l(g);if(h){h.setAttribute("jStorage",d.jStorage);h.save("jStorage")}j=d.jStorage?String(d.jStorage).length:0}catch(m){}}function a(m){if(!m||(typeof m!="string"&&typeof m!="number")){throw new TypeError("Key name must be string or numeric")}return true}f.jStorage={version:"0.1.5.1",set:function(m,n){a(m);if(_XMLService.isXML(n)){n={_is_xml:true,xml:_XMLService.encode(n)}}g[m]=n;c();return n},get:function(m,n){a(m);if(m in g){if(g[m]&&typeof g[m]=="object"&&g[m]._is_xml&&g[m]._is_xml){return _XMLService.decode(g[m].xml)}else{return g[m]}}return typeof(n)=="undefined"?null:n},deleteKey:function(m){a(m);if(m in g){delete g[m];c();return true}return false},flush:function(){g={};c();return true},storageObj:function(){function m(){}m.prototype=g;return new m()},index:function(){var m=[],n;for(n in g){if(g.hasOwnProperty(n)){m.push(n)}}return m},storageSize:function(){return j},currentBackend:function(){return i},storageAvailable:function(){return !!i},reInit:function(){var m,o;if(h&&h.addBehavior){m=document.createElement("link");h.parentNode.replaceChild(m,h);h=m;h.style.behavior="url(#default#userData)";document.getElementsByTagName("head")[0].appendChild(h);h.load("jStorage");o="{}";try{o=h.getAttribute("jStorage")}catch(n){}d.jStorage=o;i="userDataBehavior"}b()}};k()})(window.jQuery||window.$);


 /*
 * TipTip
 * Copyright 2010 Drew Wilson
 * www.drewwilson.com
 * code.drewwilson.com/entry/tiptip-jquery-plugin
 *
 * Version 1.3   -   Updated: Mar. 23, 2010
 *
 * This Plug-In will create a custom tooltip to replace the default
 * browser tooltip. It is extremely lightweight and very smart in
 * that it detects the edges of the browser window and will make sure
 * the tooltip stays within the current window size. As a result the
 * tooltip will adjust itself to be displayed above, below, to the left 
 * or to the right depending on what is necessary to stay within the
 * browser window. It is completely customizable as well via CSS.
 *
 * This TipTip jQuery plug-in is dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
(function($){$.fn.tipTip=function(options){var defaults={activation:"hover",keepAlive:false,maxWidth:"200px",edgeOffset:3,defaultPosition:"bottom",delay:400,fadeIn:200,fadeOut:200,attribute:"title",content:false,enter:function(){},exit:function(){}};var opts=$.extend(defaults,options);if($("#tiptip_holder").length<=0){var tiptip_holder=$('<div id="tiptip_holder" style="max-width:'+opts.maxWidth+';"></div>');var tiptip_content=$('<div id="tiptip_content"></div>');var tiptip_arrow=$('<div id="tiptip_arrow"></div>');$("body").append(tiptip_holder.html(tiptip_content).prepend(tiptip_arrow.html('<div id="tiptip_arrow_inner"></div>')))}else{var tiptip_holder=$("#tiptip_holder");var tiptip_content=$("#tiptip_content");var tiptip_arrow=$("#tiptip_arrow")}return this.each(function(){var org_elem=$(this);if(opts.content){var org_title=opts.content}else{var org_title=org_elem.attr(opts.attribute)}if(org_title!=""){if(!opts.content){org_elem.removeAttr(opts.attribute)}var timeout=false;if(opts.activation=="hover"){org_elem.hover(function(){active_tiptip()},function(){if(!opts.keepAlive){deactive_tiptip()}});if(opts.keepAlive){tiptip_holder.hover(function(){},function(){deactive_tiptip()})}}else if(opts.activation=="focus"){org_elem.focus(function(){active_tiptip()}).blur(function(){deactive_tiptip()})}else if(opts.activation=="click"){org_elem.click(function(){active_tiptip();return false}).hover(function(){},function(){if(!opts.keepAlive){deactive_tiptip()}});if(opts.keepAlive){tiptip_holder.hover(function(){},function(){deactive_tiptip()})}}function active_tiptip(){opts.enter.call(this);tiptip_content.html(org_title);tiptip_holder.hide().removeAttr("class").css("margin","0");tiptip_arrow.removeAttr("style");var top=parseInt(org_elem.offset()['top']);var left=parseInt(org_elem.offset()['left']);var org_width=parseInt(org_elem.outerWidth());var org_height=parseInt(org_elem.outerHeight());var tip_w=tiptip_holder.outerWidth();var tip_h=tiptip_holder.outerHeight();var w_compare=Math.round((org_width-tip_w)/2);var h_compare=Math.round((org_height-tip_h)/2);var marg_left=Math.round(left+w_compare);var marg_top=Math.round(top+org_height+opts.edgeOffset);var t_class="";var arrow_top="";var arrow_left=Math.round(tip_w-12)/2;if(opts.defaultPosition=="bottom"){t_class="_bottom"}else if(opts.defaultPosition=="top"){t_class="_top"}else if(opts.defaultPosition=="left"){t_class="_left"}else if(opts.defaultPosition=="right"){t_class="_right"}var right_compare=(w_compare+left)<parseInt($(window).scrollLeft());var left_compare=(tip_w+left)>parseInt($(window).width());if((right_compare&&w_compare<0)||(t_class=="_right"&&!left_compare)||(t_class=="_left"&&left<(tip_w+opts.edgeOffset+5))){t_class="_right";arrow_top=Math.round(tip_h-13)/2;arrow_left=-12;marg_left=Math.round(left+org_width+opts.edgeOffset);marg_top=Math.round(top+h_compare)}else if((left_compare&&w_compare<0)||(t_class=="_left"&&!right_compare)){t_class="_left";arrow_top=Math.round(tip_h-13)/2;arrow_left=Math.round(tip_w);marg_left=Math.round(left-(tip_w+opts.edgeOffset+5));marg_top=Math.round(top+h_compare)}var top_compare=(top+org_height+opts.edgeOffset+tip_h+8)>parseInt($(window).height()+$(window).scrollTop());var bottom_compare=((top+org_height)-(opts.edgeOffset+tip_h+8))<0;if(top_compare||(t_class=="_bottom"&&top_compare)||(t_class=="_top"&&!bottom_compare)){if(t_class=="_top"||t_class=="_bottom"){t_class="_top"}else{t_class=t_class+"_top"}arrow_top=tip_h;marg_top=Math.round(top-(tip_h+5+opts.edgeOffset))}else if(bottom_compare|(t_class=="_top"&&bottom_compare)||(t_class=="_bottom"&&!top_compare)){if(t_class=="_top"||t_class=="_bottom"){t_class="_bottom"}else{t_class=t_class+"_bottom"}arrow_top=-12;marg_top=Math.round(top+org_height+opts.edgeOffset)}if(t_class=="_right_top"||t_class=="_left_top"){marg_top=marg_top+5}else if(t_class=="_right_bottom"||t_class=="_left_bottom"){marg_top=marg_top-5}if(t_class=="_left_top"||t_class=="_left_bottom"){marg_left=marg_left+5}tiptip_arrow.css({"margin-left":arrow_left+"px","margin-top":arrow_top+"px"});tiptip_holder.css({"margin-left":marg_left+"px","margin-top":marg_top+"px"}).attr("class","tip"+t_class);if(timeout){clearTimeout(timeout)}timeout=setTimeout(function(){tiptip_holder.stop(true,true).fadeIn(opts.fadeIn)},opts.delay)}function deactive_tiptip(){opts.exit.call(this);if(timeout){clearTimeout(timeout)}tiptip_holder.fadeOut(opts.fadeOut)}}})}})(jQuery);
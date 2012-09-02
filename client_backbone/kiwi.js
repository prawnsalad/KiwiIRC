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





/**
*   Formats a message. Adds bold, underline and colouring
*   @param      {String}    msg The message to format
*   @returns    {String}        The HTML formatted message
*/
function formatIRCMsg (msg) {
    var re, next;

    if ((!msg) || (typeof msg !== 'string')) {
        return '';
    }

    // bold
    if (msg.indexOf(String.fromCharCode(2)) !== -1) {
        next = '<b>';
        while (msg.indexOf(String.fromCharCode(2)) !== -1) {
            msg = msg.replace(String.fromCharCode(2), next);
            next = (next === '<b>') ? '</b>' : '<b>';
        }
        if (next === '</b>') {
            msg = msg + '</b>';
        }
    }

    // underline
    if (msg.indexOf(String.fromCharCode(31)) !== -1) {
        next = '<u>';
        while (msg.indexOf(String.fromCharCode(31)) !== -1) {
            msg = msg.replace(String.fromCharCode(31), next);
            next = (next === '<u>') ? '</u>' : '<u>';
        }
        if (next === '</u>') {
            msg = msg + '</u>';
        }
    }

    // colour
    /**
    *   @inner
    */
    msg = (function (msg) {
        var replace, colourMatch, col, i, match, to, endCol, fg, bg, str;
        replace = '';
        /**
        *   @inner
        */
        colourMatch = function (str) {
            var re = /^\x03([0-9][0-5]?)(,([0-9][0-5]?))?/;
            return re.exec(str);
        };
        /**
        *   @inner
        */
        col = function (num) {
            switch (parseInt(num, 10)) {
            case 0:
                return '#FFFFFF';
            case 1:
                return '#000000';
            case 2:
                return '#000080';
            case 3:
                return '#008000';
            case 4:
                return '#FF0000';
            case 5:
                return '#800040';
            case 6:
                return '#800080';
            case 7:
                return '#FF8040';
            case 8:
                return '#FFFF00';
            case 9:
                return '#80FF00';
            case 10:
                return '#008080';
            case 11:
                return '#00FFFF';
            case 12:
                return '#0000FF';
            case 13:
                return '#FF55FF';
            case 14:
                return '#808080';
            case 15:
                return '#C0C0C0';
            default:
                return null;
            }
        };
        if (msg.indexOf('\x03') !== -1) {
            i = msg.indexOf('\x03');
            replace = msg.substr(0, i);
            while (i < msg.length) {
                /**
                *   @inner
                */
                match = colourMatch(msg.substr(i, 6));
                if (match) {
                    //console.log(match);
                    // Next colour code
                    to = msg.indexOf('\x03', i + 1);
                    endCol = msg.indexOf(String.fromCharCode(15), i + 1);
                    if (endCol !== -1) {
                        if (to === -1) {
                            to = endCol;
                        } else {
                            to = ((to < endCol) ? to : endCol);
                        }
                    }
                    if (to === -1) {
                        to = msg.length;
                    }
                    //console.log(i, to);
                    fg = col(match[1]);
                    bg = col(match[3]);
                    str = msg.substring(i + 1 + match[1].length + ((bg !== null) ? match[2].length + 1 : 0), to);
                    //console.log(str);
                    replace += '<span style="' + ((fg !== null) ? 'color: ' + fg + '; ' : '') + ((bg !== null) ? 'background-color: ' + bg + ';' : '') + '">' + str + '</span>';
                    i = to;
                } else {
                    if ((msg[i] !== '\x03') && (msg[i] !== String.fromCharCode(15))) {
                        replace += msg[i];
                    }
                    i++;
                }
            }
            return replace;
        }
        return msg;
    }(msg));
    
    return msg;
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
            //if (kiwi.front.cur_channel.name.toLowerCase() !== kiwi.front.tabviews[event.tabview.toLowerCase()].name) {
            //    kiwi.front.tabviews[event.tabview].activity();
            //}

            return event;
        }
    },

    {
        name: "highlight",
        onaddmsg: function (event, opts) {
            //var tab = Tabviews.getTab(event.tabview.toLowerCase());

            // If we have a highlight...
            //if (event.msg.toLowerCase().indexOf(kiwi.gateway.nick.toLowerCase()) > -1) {
            //    if (Tabview.getCurrentTab() !== tab) {
            //        tab.highlight();
            //    }
            //    if (kiwi.front.isChannel(tab.name)) {
            //        event.msg = '<span style="color:red;">' + event.msg + '</span>';
            //    }
            //}

            // If it's a PM, highlight
            //if (!kiwi.front.isChannel(tab.name) && tab.name !== "server"
            //    && Tabview.getCurrentTab().name.toLowerCase() !== tab.name
            //) {
            //    tab.highlight();
            //}

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

            //if (typeof kiwi.front.tabviews[event.tabview].nick_colours === 'undefined') {
            //    kiwi.front.tabviews[event.tabview].nick_colours = {};
            //}

            //if (typeof kiwi.front.tabviews[event.tabview].nick_colours[event.nick] === 'undefined') {
            //    kiwi.front.tabviews[event.tabview].nick_colours[event.nick] = this.randColour();
            //}

            //var c = kiwi.front.tabviews[event.tabview].nick_colours[event.nick];
            var c = this.randColour();
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
 * jQuery jStorage plugin 
 * https://github.com/andris9/jStorage/
 */
(function(f){if(!f||!(f.toJSON||Object.toJSON||window.JSON)){throw new Error("jQuery, MooTools or Prototype needs to be loaded before jStorage!")}var g={},d={jStorage:"{}"},h=null,j=0,l=f.toJSON||Object.toJSON||(window.JSON&&(JSON.encode||JSON.stringify)),e=f.evalJSON||(window.JSON&&(JSON.decode||JSON.parse))||function(m){return String(m).evalJSON()},i=false;_XMLService={isXML:function(n){var m=(n?n.ownerDocument||n:0).documentElement;return m?m.nodeName!=="HTML":false},encode:function(n){if(!this.isXML(n)){return false}try{return new XMLSerializer().serializeToString(n)}catch(m){try{return n.xml}catch(o){}}return false},decode:function(n){var m=("DOMParser" in window&&(new DOMParser()).parseFromString)||(window.ActiveXObject&&function(p){var q=new ActiveXObject("Microsoft.XMLDOM");q.async="false";q.loadXML(p);return q}),o;if(!m){return false}o=m.call("DOMParser" in window&&(new DOMParser())||window,n,"text/xml");return this.isXML(o)?o:false}};function k(){if("localStorage" in window){try{if(window.localStorage){d=window.localStorage;i="localStorage"}}catch(p){}}else{if("globalStorage" in window){try{if(window.globalStorage){d=window.globalStorage[window.location.hostname];i="globalStorage"}}catch(o){}}else{h=document.createElement("link");if(h.addBehavior){h.style.behavior="url(#default#userData)";document.getElementsByTagName("head")[0].appendChild(h);h.load("jStorage");var n="{}";try{n=h.getAttribute("jStorage")}catch(m){}d.jStorage=n;i="userDataBehavior"}else{h=null;return}}}b()}function b(){if(d.jStorage){try{g=e(String(d.jStorage))}catch(m){d.jStorage="{}"}}else{d.jStorage="{}"}j=d.jStorage?String(d.jStorage).length:0}function c(){try{d.jStorage=l(g);if(h){h.setAttribute("jStorage",d.jStorage);h.save("jStorage")}j=d.jStorage?String(d.jStorage).length:0}catch(m){}}function a(m){if(!m||(typeof m!="string"&&typeof m!="number")){throw new TypeError("Key name must be string or numeric")}return true}f.jStorage={version:"0.1.5.1",set:function(m,n){a(m);if(_XMLService.isXML(n)){n={_is_xml:true,xml:_XMLService.encode(n)}}g[m]=n;c();return n},get:function(m,n){a(m);if(m in g){if(g[m]&&typeof g[m]=="object"&&g[m]._is_xml&&g[m]._is_xml){return _XMLService.decode(g[m].xml)}else{return g[m]}}return typeof(n)=="undefined"?null:n},deleteKey:function(m){a(m);if(m in g){delete g[m];c();return true}return false},flush:function(){g={};c();return true},storageObj:function(){function m(){}m.prototype=g;return new m()},index:function(){var m=[],n;for(n in g){if(g.hasOwnProperty(n)){m.push(n)}}return m},storageSize:function(){return j},currentBackend:function(){return i},storageAvailable:function(){return !!i},reInit:function(){var m,o;if(h&&h.addBehavior){m=document.createElement("link");h.parentNode.replaceChild(m,h);h=m;h.style.behavior="url(#default#userData)";document.getElementsByTagName("head")[0].appendChild(h);h.load("jStorage");o="{}";try{o=h.getAttribute("jStorage")}catch(n){}d.jStorage=o;i="userDataBehavior"}b()}};k()})(window.jQuery||window.$);
/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */
kiwi.model = {};

kiwi.model.MemberList = Backbone.Collection.extend({
    model: kiwi.model.Member,
    comparator: function (a, b) {
        var i, a_modes, b_modes, a_idx, b_idx, a_nick, b_nick;
        var user_prefixes = kiwi.gateway.get('user_prefixes');
        a_modes = a.get("modes");
        b_modes = b.get("modes");
        // Try to sort by modes first
        if (a_modes.length > 0) {
            // a has modes, but b doesn't so a should appear first
            if (b_modes.length === 0) {
                return -1;
            }
            a_idx = b_idx = -1;
            // Compare the first (highest) mode
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === a_modes[0]) {
                    a_idx = i;
                }
            }
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === b_modes[0]) {
                    b_idx = i;
                }
            }
            if (a_idx < b_idx) {
                return -1;
            } else if (a_idx > b_idx) {
                return 1;
            }
            // If we get to here both a and b have the same highest mode so have to resort to lexicographical sorting

        } else if (b_modes.length > 0) {
            // b has modes but a doesn't so b should appear first
            return 1;
        }
        a_nick = a.get("nick").toLocaleUpperCase();
        b_nick = b.get("nick").toLocaleUpperCase();
        // Lexicographical sorting
        if (a_nick < b_nick) {
            return -1;
        } else if (a_nick > b_nick) {
            return 1;
        } else {
            // This should never happen; both users have the same nick.
            console.log('Something\'s gone wrong somewhere - two users have the same nick!');
            return 0;
        }
    },
    initialize: function (options) {
        this.view = new kiwi.view.MemberList({"model": this});
    },
    getByNick: function (nick) {
        if (typeof nick !== 'string') return;
        return this.find(function (m) {
            return nick.toLowerCase() === m.get('nick').toLowerCase();
        });
    }
});

kiwi.model.Member = Backbone.Model.extend({
    sortModes: function (modes) {
        return modes.sort(function (a, b) {
            var a_idx, b_idx, i;
            var user_prefixes = kiwi.gateway.get('user_prefixes');

            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === a) {
                    a_idx = i;
                }
            }
            for (i = 0; i < user_prefixes.length; i++) {
                if (user_prefixes[i].mode === b) {
                    b_idx = i;
                }
            }
            if (a_idx < b_idx) {
                return -1;
            } else if (a_idx > b_idx) {
                return 1;
            } else {
                return 0;
            }
        });
    },
    initialize: function (attributes) {
        var nick, modes, prefix;
        nick = this.stripPrefix(this.get("nick"));

        modes = this.get("modes");
        modes = modes || [];
        this.sortModes(modes);
        this.set({"nick": nick, "modes": modes, "prefix": this.getPrefix(modes)}, {silent: true});
    },
    addMode: function (mode) {
        var modes_to_add = mode.split(''),
            modes, prefix;

        modes = this.get("modes");
        $.each(modes_to_add, function (index, item) {
            modes.push(item);
        });
        
        modes = this.sortModes(modes);
        this.set({"prefix": this.getPrefix(modes), "modes": modes});
    },
    removeMode: function (mode) {
        var modes_to_remove = mode.split(''),
            modes, prefix;

        modes = this.get("modes");
        modes = _.reject(modes, function (m) {
            return (modes_to_remove.indexOf(m) !== -1);
        });

        this.set({"prefix": this.getPrefix(modes), "modes": modes});
    },
    getPrefix: function (modes) {
        var prefix = '';
        var user_prefixes = kiwi.gateway.get('user_prefixes');

        if (typeof modes[0] !== 'undefined') {
            prefix = _.detect(user_prefixes, function (prefix) {
                return prefix.mode === modes[0];
            });
            prefix = (prefix) ? prefix.symbol : '';
        }
        return prefix;
    },
    stripPrefix: function (nick) {
        var tmp = nick, i, j, k;
        var user_prefixes = kiwi.gateway.get('user_prefixes');
        i = 0;

        for (j = 0; j < nick.length; j++) {
            for (k = 0; k < user_prefixes.length; k++) {
                if (nick.charAt(j) === user_prefixes[k].symbol) {
                    i++;
                    break;
                }
            }
        }

        return tmp.substr(i);
    },
    displayNick: function (full) {
        var display = this.get('nick');

        if (full) {
            if (this.get("ident")) {
                display += ' [' + this.get("ident") + '@' + this.get("hostname") + ']';
            }
        }

        return display;
    }
});

kiwi.model.PanelList = Backbone.Collection.extend({
    model: kiwi.model.Panel,

    // Holds the active panel
    active: null,

    comparator: function (chan) {
        return chan.get("name");
    },
    initialize: function () {
        this.view = new kiwi.view.Tabs({"el": $('#toolbar .panellist')[0], "model": this});

        // Automatically create a server tab
        this.server = new kiwi.model.Server({'name': kiwi.gateway.get('name')});
        kiwi.gateway.on('change:name', this.view.render, this.view);
        this.add(this.server);

        this.bind('active', function (active_panel) {
            this.active = active_panel;
        }, this);

    },
    getByName: function (name) {
        if (typeof name !== 'string') return;
        return this.find(function (c) {
            return name.toLowerCase() === c.get('name').toLowerCase();
        });
    }
});

kiwi.model.Panel = Backbone.Model.extend({
    initialize: function (attributes) {
        var name = this.get("name") || "";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});
    },

    addMsg: function (nick, msg, type, opts) {
        var message_obj, bs, d;

        opts = opts || {};

        // Time defaults to now
        if (!opts || typeof opts.time === 'undefined') {
            d = new Date();
            opts.time = d.getHours().toString().lpad(2, "0") + ":" + d.getMinutes().toString().lpad(2, "0") + ":" + d.getSeconds().toString().lpad(2, "0");
        }

        // CSS style defaults to empty string
        if (!opts || typeof opts.style === 'undefined') {
            opts.style = '';
        }

        // Escape any HTML that may be in here
        // This doesn't seem right to be here.. should be in view (??)
        msg =  $('<div />').text(msg).html();

        // Run through the plugins
        message_obj = {"msg": msg, "time": opts.time, "nick": nick, "chan": this.get("name"), "type": type, "style": opts.style};
        //tmp = kiwi.plugs.run('addmsg', message_obj);
        if (!message_obj) {
            return;
        }

        // The CSS class (action, topic, notice, etc)
        if (typeof message_obj.type !== "string") {
            message_obj.type = '';
        }

        // Make sure we don't have NaN or something
        if (typeof message_obj.msg !== "string") {
            message_obj.msg = '';
        }

        // Convert IRC formatting into HTML formatting
        message_obj.msg = formatIRCMsg(message_obj.msg);

        // Update the scrollback
        bs = this.get("scrollback");
        bs.push(message_obj);

        // Keep the scrolback limited
        if (bs.length > 250) {
            bs.splice(250);
        }
        this.set({"scrollback": bs}, {silent: true});

        this.trigger("msg", message_obj);
    },

    close: function () {
        this.view.remove();
        delete this.view;

        var members = this.get('members');
        if (members) {
            members.reset([]);
            this.unset('members');
        }

        this.destroy();

        // If closing the active panel, switch to the server panel
        if (this.cid === kiwi.app.panels.active.cid) {
            kiwi.app.panels.server.view.show();
        }
    },

    isChannel: function () {
        var channel_prefix = kiwi.gateway.get('channel_prefix'),
            this_name = this.get('name');

        if (!this_name) return false;
        return (channel_prefix.indexOf(this_name[0]) > -1);
    }
});

kiwi.model.Server = kiwi.model.Panel.extend({
    server_login: null,

    initialize: function (attributes) {
        var name = "Server";
        this.view = new kiwi.view.Panel({"model": this, "name": name});
        this.set({
            "scrollback": [],
            "name": name
        }, {"silent": true});

        //this.addMsg(' ', '--> Kiwi IRC: Such an awesome IRC client', '', {style: 'color:#009900;'});

        this.server_login = new kiwi.view.ServerSelect();
        
        this.view.$el.append(this.server_login.$el);
        this.server_login.show();
    }
});

// TODO: Channel modes
// TODO: Listen to gateway events for anythign related to this channel
kiwi.model.Channel = kiwi.model.Panel.extend({
    initialize: function (attributes) {
        var that = this,
            name = this.get("name") || "",
            members;

        this.view = new kiwi.view.Channel({"model": this, "name": name});
        this.set({
            "members": new kiwi.model.MemberList(),
            "name": name,
            "scrollback": [],
            "topic": ""
        }, {"silent": true});

        members = this.get("members");
        members.bind("add", function (member) {
            this.addMsg(' ', '--> ' + member.displayNick(true) + ' has joined', 'action join');
        }, this);

        members.bind("remove", function (member, members, options) {
            var msg = (options.message) ? '(' + options.message + ')' : '';

            if (options.type === 'quit') {
                this.addMsg(' ', '<-- ' + member.displayNick(true) + ' has quit ' + msg, 'action quit');
            } else {
                this.addMsg(' ', '<-- ' + member.displayNick(true) + ' has left ' + msg, 'action part');
            }
        }, this);
    }
});

kiwi.model.Application = Backbone.Model.extend(new (function () {
    var that = this;

    // The auto connect details entered into the server select box
    var auto_connect_details = {};

    /** Instance of kiwi.model.PanelList */
    this.panels = null;

    this.initialize = function () {
        // Update `that` with this new Model object
        that = this;
    };

    this.start = function () {
        // Set the gateway up
        kiwi.gateway = new kiwi.model.Gateway();
        this.bindGatewayCommands(kiwi.gateway);

        this.initializeClient();
        this.view.barsHide(true);

        this.panels.server.server_login.bind('server_connect', function (event) {
            auto_connect_details = event;

            kiwi.gateway.set('nick', event.nick);
            kiwi.gateway.connect(event.server, 6667, false, false, function () {});
        });

    };


    this.initializeClient = function () {
        this.view = new kiwi.view.Application({model: this, el: this.get('container')});

        
        /**
         * Set the UI components up
         */
        this.panels = new kiwi.model.PanelList();

        this.controlbox = new kiwi.view.ControlBox({el: $('#controlbox')[0]});
        this.bindControllboxCommands(this.controlbox);

        this.topicbar = new kiwi.view.TopicBar({el: $('#topic')[0]});

        
        this.panels.server.view.show();

        // Rejigg the UI sizes
        this.view.doLayout();

        // Populate the server select box with defaults
        this.panels.server.server_login.populateFields({
            'nick': getQueryVariable('nick') || 'kiwi_' + Math.ceil(Math.random() * 10000).toString(),
            'server': getQueryVariable('server') || 'irc.kiwiirc.com',
            'channel': window.location.hash || '#test'
        });
    };



    this.bindGatewayCommands = function (gw) {
        gw.on('onmotd', function (event) {
            that.panels.server.addMsg(event.server, event.msg, 'motd');
        });


        gw.on('onconnect', function (event) {
            that.view.barsShow();
            
            if (auto_connect_details.channel) {
                kiwi.gateway.join(auto_connect_details.channel);
            }
        });


        gw.on('onjoin', function (event) {
            var c, members, user;
            c = that.panels.getByName(event.channel);
            if (!c) {
                c = new kiwi.model.Channel({name: event.channel});
                that.panels.add(c);
            }

            members = c.get('members');
            if (!members) return;

            user = new kiwi.model.Member({nick: event.nick, ident: event.ident, hostname: event.hostname});
            members.add(user);
            // TODO: highlight the new channel in some way
        });


        gw.on('onpart', function (event) {
            var channel, members, user,
                part_options = {};

            part_options.type = 'part';
            part_options.message = event.message || '';

            channel = that.panels.getByName(event.channel);
            if (!channel) return;

            // If this is us, close the panel
            if (event.nick === kiwi.gateway.get('nick')) {
                channel.close();
                return;
            }

            members = channel.get('members');
            if (!members) return;

            user = members.getByNick(event.nick);
            if (!user) return;

            members.remove(user, part_options);
        });


        gw.on('onquit', function (event) {
            var member, members,
                quit_options = {};

            quit_options.type = 'quit';
            quit_options.message = event.message || '';

            $.each(that.panels.models, function (index, panel) {
                if (!panel.isChannel()) return;

                member = panel.get('members').getByNick(event.nick);
                if (member) {
                    panel.get('members').remove(member, quit_options);
                }
            });
        });


        gw.on('onmsg', function (event) {
            var panel,
                is_pm = (event.channel == kiwi.gateway.get('nick'));

            if (is_pm) {
                // If a panel isn't found for this PM, create one
                panel = that.panels.getByName(event.nick);
                if (!panel) {
                    panel = new kiwi.model.Channel({name: event.nick});
                    that.panels.add(panel);
                }

            } else {
                // If a panel isn't found for this channel, reroute to the
                // server panel
                panel = that.panels.getByName(event.channel);
                if (!panel) {
                    panel = that.panels.server;
                }
            }
            
            panel.addMsg(event.nick, event.msg);
        });


        gw.on('onnotice', function (event) {
            var panel;

            // Find a panel for the destination(channel) or who its from
            panel = that.panels.getByName(event.target) || that.panels.getByName(event.nick);
            if (!panel) {
                panel = that.panels.server;
            }

            panel.addMsg('[' + (event.nick||'') + ']', event.msg);
        });


        gw.on('onaction', function (event) {
            var panel,
                is_pm = (event.channel == kiwi.gateway.get('nick'));

            if (is_pm) {
                // If a panel isn't found for this PM, create one
                panel = that.panels.getByName(event.nick);
                if (!panel) {
                    panel = new kiwi.model.Channel({name: event.nick});
                    that.panels.add(panel);
                }

            } else {
                // If a panel isn't found for this channel, reroute to the
                // server panel
                panel = that.panels.getByName(event.channel);
                if (!panel) {
                    panel = that.panels.server;
                }
            }

            panel.addMsg('', '* ' + event.nick + ' ' + event.msg, 'action');
        });


        gw.on('ontopic', function (event) {
            var c;
            c = that.panels.getByName(event.channel);
            if (!c) return;

            // Set the channels topic
            c.set('topic', event.topic);

            // If this is the active channel, update the topic bar too
            if (c.get('name') === kiwi.app.panels.active.get('name')) {
                that.topicbar.setCurrentTopic(event.topic);
            }
        });


        gw.on('ontopicsetby', function (event) {
            var c, when;
            c = that.panels.getByName(event.channel);
            if (!c) return;

            when = new Date(event.when * 1000).toLocaleString();
            c.addMsg('', 'Topic set by ' + event.nick + ' at ' + when, 'topic');
        });


        gw.on('onuserlist', function (event) {
            var channel;
            channel = that.panels.getByName(event.channel);

            // If we didn't find a channel for this, may aswell leave
            if (!channel) return;

            channel.temp_userlist = channel.temp_userlist || [];
            _.each(event.users, function (item) {
                var user = new kiwi.model.Member({nick: item.nick, modes: item.modes});
                channel.temp_userlist.push(user);
            });
        });


        gw.on('onuserlist_end', function (event) {
            var channel;
            channel = that.panels.getByName(event.channel);

            // If we didn't find a channel for this, may aswell leave
            if (!channel) return;

            // Update the members list with the new list
            channel.get('members').reset(channel.temp_userlist || []);

            // Clear the temporary userlist
            delete channel.temp_userlist;
        });


        gw.on('onmode', function (event) {
            var channel, members, member;

            if (!event.channel) return;
            channel = that.panels.getByName(event.channel);
            if (!channel) return;

            members = channel.get('members');
            if (!members) return;

            member = members.getByNick(event.effected_nick);
            if (!member) return;

            if (event.mode[0] === '+') {
                member.addMode(event.mode.substr(1));
            } else if (event.mode[0] === '-') {
                member.removeMode(event.mode.substr(1));
            }
        });


        gw.on('onnick', function (event) {
            var member;

            $.each(that.panels.models, function (index, panel) {
                if (!panel.isChannel()) return;

                member = panel.get('members').getByNick(event.nick);
                if (member) {
                    member.set('nick', event.newnick);
                    panel.addMsg('', '== ' + event.nick + ' is now known as ' + event.newnick, 'action nick');
                }
            });
        });
    };



    /**
     * Bind to certain commands that may be typed into the control box
     */
    this.bindControllboxCommands = function (controlbox) {
        controlbox.on('unknown_command', this.unknownCommand);

        controlbox.on('command', this.allCommands);
        controlbox.on('command_msg', this.msgCommand);

        controlbox.on('command_action', this.actionCommand);
        controlbox.on('command_me', this.actionCommand);

        controlbox.on('command_join', this.joinCommand);
        controlbox.on('command_j', this.joinCommand);

        controlbox.on('command_part', this.partCommand);
        controlbox.on('command_p', this.partCommand);

        controlbox.on('command_nick', function (ev) {
            kiwi.gateway.changeNick(ev.params[0]);
        });

        controlbox.on('command_query', this.queryCommand);
        controlbox.on('command_q', this.queryCommand);

        controlbox.on('command_topic', this.topicCommand);

        controlbox.on('command_notice', this.noticeCommand);

        controlbox.on('command_css', function (ev) {
            var queryString = '?reload=' + new Date().getTime();
            $('link[rel="stylesheet"]').each(function () {
                this.href = this.href.replace(/\?.*|$/, queryString);
            });
        });
    };

    // A fallback action. Send a raw command to the server
    this.unknownCommand = function (ev) {
        var raw_cmd = ev.command + ' ' + ev.params.join(' ');
        console.log('RAW: ' + raw_cmd);
        kiwi.gateway.raw(raw_cmd);
    };

    this.allCommands = function (ev) {
        console.log('allCommands', ev);
    };

    this.joinCommand = function (ev) {
        var channel, channel_names;

        channel_names = ev.params.join(' ').split(',');

        $.each(channel_names, function (index, channel_name) {
            // Trim any whitespace off the name
            channel_name = channel_name.trim();

            // Check if we have the panel already. If not, create it
            channel = that.panels.getByName(channel_name);
            if (!channel) {
                channel = new kiwi.model.Channel({name: channel_name});
                kiwi.app.panels.add(channel);
            }

            kiwi.gateway.join(channel_name);
        });

        if (channel) channel.view.show();
        
    };

    this.queryCommand = function (ev) {
        var destination, panel;

        destination = ev.params[0];

        // Check if we have the panel already. If not, create it
        panel = that.panels.getByName(destination);
        if (!panel) {
            panel = new kiwi.model.Channel({name: destination});
            kiwi.app.panels.add(panel);
        }

        if (panel) panel.view.show();
        
    };

    this.msgCommand = function (ev) {
        var destination = ev.params[0],
            panel = that.panels.getByName(destination) || that.panels.server;

        ev.params.shift();

        panel.addMsg(kiwi.gateway.get('nick'), ev.params.join(' '));
        kiwi.gateway.privmsg(destination, ev.params.join(' '));
    };

    this.actionCommand = function (ev) {
        if (kiwi.app.panels.active === kiwi.app.panels.server) {
            return;
        }

        var panel = kiwi.app.panels.active;
        panel.addMsg('', '* ' + kiwi.gateway.get('nick') + ' ' + ev.params.join(' '), 'action');
        kiwi.gateway.action(panel.get('name'), ev.params.join(' '));
    };

    this.partCommand = function (ev) {
        if (ev.params.length === 0) {
            kiwi.gateway.part(kiwi.app.panels.active.get('name'));
        } else {
            _.each(ev.params, function (channel) {
                kiwi.gateway.part(channel);
            });
        }
        // TODO: More responsive = close tab now, more accurate = leave until part event
        //kiwi.app.panels.remove(kiwi.app.panels.active);
    };

    this.topicCommand = function (ev) {
        var channel_name;

        if (ev.params.length === 0) return;

        if (that.isChannelName(ev.params[0])) {
            channel_name = ev.params[0];
            ev.params.shift();
        } else {
            channel_name = kiwi.app.panels.active.get('name');
        }

        kiwi.gateway.topic(channel_name, ev.params.join(' '));
    };

    this.noticeCommand = function (ev) {
        var destination;

        // Make sure we have a destination and some sort of message
        if (ev.params.length <= 1) return;

        destination = ev.params[0];
        ev.params.shift();

        kiwi.gateway.notice(destination, ev.params.join(' '));
    };





    this.isChannelName = function (channel_name) {
        var channel_prefix = kiwi.gateway.get('channel_prefix');

        if (!channel_name || !channel_name.length) return false;
        return (channel_prefix.indexOf(channel_name[0]) > -1);
    };

})());
kiwi.model.Gateway = Backbone.Model.extend(new (function () {
    var that = this;

    this.defaults = {
        /**
        *   The name of the network
        *   @type    String
        */
        name: 'Server',

        /**
        *   The address (URL) of the network
        *   @type    String
        */
        address: '',

        /**
        *   The current nickname
        *   @type   String
        */
        nick: '',

        /**
        *   The channel prefix for this network
        *   @type    String
        */
        channel_prefix: '#',

        /**
        *   The user prefixes for channel owner/admin/op/voice etc. on this network
        *   @type   Array
        */
        user_prefixes: ['~', '&', '@', '+'],

        /**
        *   The URL to the Kiwi server
        *   @type   String
        */
        //kiwi_server: '//kiwi'
        kiwi_server: 'http://localhost:7778/kiwi'
    };


    this.initialize = function () {
        // Update `that` with this new Model object
        that = this;

        // For ease of access. The socket.io object
        this.socket = this.get('socket');

        // Redundant perhaps? Legacy
        this.session_id = '';

        network = this;
    };


    /**
    *   Connects to the server
    *   @param  {String}    host        The hostname or IP address of the IRC server to connect to
    *   @param  {Number}    port        The port of the IRC server to connect to
    *   @param  {Boolean}   ssl         Whether or not to connect to the IRC server using SSL
    *   @param  {String}    password    The password to supply to the IRC server during registration
    *   @param  {Function}  callback    A callback function to be invoked once Kiwi's server has connected to the IRC server
    */
    this.connect = function (host, port, ssl, password, callback) {
        this.socket = io.connect(this.get('kiwi_server'), {
            'try multiple transports': true,
            'connect timeout': 3000,
            'max reconnection attempts': 7,
            'reconnection delay': 2000
        });
        this.socket.on('connect_failed', function (reason) {
            // TODO: When does this even actually get fired? I can't find a case! ~Darren
            console.debug('Unable to connect Socket.IO', reason);
            console.log("kiwi.gateway.socket.on('connect_failed')");
            //kiwi.front.tabviews.server.addMsg(null, ' ', 'Unable to connect to Kiwi IRC.\n' + reason, 'error');
            this.socket.disconnect();
            this.emit("connect_fail", {reason: reason});
        });

        this.socket.on('error', function (e) {
            this.emit("connect_fail", {reason: e});
            console.log("kiwi.gateway.socket.on('error')", {reason: e});
        });

        this.socket.on('connecting', function (transport_type) {
            console.log("kiwi.gateway.socket.on('connecting')");
            this.emit("connecting");
            that.trigger("connecting");
        });

        this.socket.on('connect', function () {
            this.emit('irc connect', that.get('nick'), host, port, ssl, password, callback);
            console.log("kiwi.gateway.socket.on('connect')");
        });

        this.socket.on('too_many_connections', function () {
            this.emit("connect_fail", {reason: 'too_many_connections'});
        });

        this.socket.on('message', this.parse);

        this.socket.on('disconnect', function () {
            this.emit("disconnect", {});
            console.log("kiwi.gateway.socket.on('disconnect')");
        });

        this.socket.on('close', function () {
            console.log("kiwi.gateway.socket.on('close')");
        });

        this.socket.on('reconnecting', function (reconnectionDelay, reconnectionAttempts) {
            console.log("kiwi.gateway.socket.on('reconnecting')");
            this.emit("reconnecting", {delay: reconnectionDelay, attempts: reconnectionAttempts});
        });

        this.socket.on('reconnect_failed', function () {
            console.log("kiwi.gateway.socket.on('reconnect_failed')");
        });
    };


    /*
        Events:
            msg
            action
            server_connect
            options
            motd
            notice
            userlist
            nick
            join
            topic
            part
            kick
            quit
            whois
            syncchannel_redirect
            debug
    */
    /**
    *   Parses the response from the server
    */
    this.parse = function (item) {
        console.log('gateway event', item);
        if (item.event !== undefined) {
            that.trigger('on' + item.event, item);

            switch (item.event) {
            case 'options':
                $.each(item.options, function (name, value) {
                    switch (name) {
                    case 'CHANTYPES':
                        // TODO: Check this. Why is it only getting the first char?
                        that.set('channel_prefix', value.charAt(0));
                        break;
                    case 'NETWORK':
                        that.set('name', value);
                        break;
                    case 'PREFIX':
                        that.set('user_prefixes', value);
                        break;
                    }
                });
                break;

            case 'connect':
                that.set('nick', item.nick);
                break;

            case 'nick':
                if (item.nick === that.get('nick')) {
                    that.set('nick', item.newnick);
                }
                break;
            /*
            case 'sync':
                if (kiwi.gateway.onSync && kiwi.gateway.syncing) {
                    kiwi.gateway.syncing = false;
                    kiwi.gateway.onSync(item);
                }
                break;
            */

            case 'kiwi':
                this.emit('kiwi.' + item.namespace, item.data);
                break;
            }
        }
    };

    /**
    *   Sends data to the server
    *   @private
    *   @param  {Object}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    this.sendData = function (data, callback) {
        this.socket.emit('message', {sid: this.session_id, data: JSON.stringify(data)}, callback);
    };

    /**
    *   Sends a PRIVMSG message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.privmsg = function (target, msg, callback) {
        var data = {
            method: 'privmsg',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a NOTICE message
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.notice = function (target, msg, callback) {
        var data = {
            method: 'notice',
            args: {
                target: target,
                msg: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a CTCP message
    *   @param  {Boolean}   request     Indicates whether this is a CTCP request (true) or reply (false)
    *   @param  {String}    type        The type of CTCP message, e.g. 'VERSION', 'TIME', 'PING' etc.
    *   @param  {String}    target      The target of the message, e.g a channel or nick
    *   @param  {String}    params      Additional paramaters
    *   @param  {Function}  callback    A callback function
    */
    this.ctcp = function (request, type, target, params, callback) {
        var data = {
            method: 'ctcp',
            args: {
                request: request,
                type: type,
                target: target,
                params: params
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   @param  {String}    target      The target of the message (e.g. a channel or nick)
    *   @param  {String}    msg         The message to send
    *   @param  {Function}  callback    A callback function
    */
    this.action = function (target, msg, callback) {
        this.ctcp(true, 'ACTION', target, msg, callback);
    };

    /**
    *   Joins a channel
    *   @param  {String}    channel     The channel to join
    *   @param  {String}    key         The key to the channel
    *   @param  {Function}  callback    A callback function
    */
    this.join = function (channel, key, callback) {
        var data = {
            method: 'join',
            args: {
                channel: channel,
                key: key
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Leaves a channel
    *   @param  {String}    channel     The channel to part
    *   @param  {Function}  callback    A callback function
    */
    this.part = function (channel, callback) {
        var data = {
            method: 'part',
            args: {
                channel: channel
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Queries or modifies a channell topic
    *   @param  {String}    channel     The channel to query or modify
    *   @param  {String}    new_topic   The new topic to set
    *   @param  {Function}  callback    A callback function
    */
    this.topic = function (channel, new_topic, callback) {
        var data = {
            method: 'topic',
            args: {
                channel: channel,
                topic: new_topic
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Kicks a user from a channel
    *   @param  {String}    channel     The channel to kick the user from
    *   @param  {String}    nick        The nick of the user to kick
    *   @param  {String}    reason      The reason for kicking the user
    *   @param  {Function}  callback    A callback function
    */
    this.kick = function (channel, nick, reason, callback) {
        var data = {
            method: 'kick',
            args: {
                channel: channel,
                nick: nick,
                reason: reason
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Disconnects us from the server
    *   @param  {String}    msg         The quit message to send to the IRC server
    *   @param  {Function}   callback    A callback function
    */
    this.quit = function (msg, callback) {
        msg = msg || "";
        var data = {
            method: 'quit',
            args: {
                message: msg
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends a string unmodified to the IRC server
    *   @param  {String}    data        The data to send to the IRC server
    *   @param  {Function}  callback    A callback function
    */
    this.raw = function (data, callback) {
        data = {
            method: 'raw',
            args: {
                data: data
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Changes our nickname
    *   @param  {String}    new_nick    Our new nickname
    *   @param  {Function}  callback    A callback function
    */
    this.changeNick = function (new_nick, callback) {
        var data = {
            method: 'nick',
            args: {
                nick: new_nick
            }
        };

        this.sendData(data, callback);
    };

    /**
    *   Sends data to a fellow Kiwi IRC user
    *   @param  {String}    target      The nick of the Kiwi IRC user to send to
    *   @param  {String}    data        The data to send
    *   @param  {Function}  callback    A callback function
    */
    this.kiwi = function (target, data, callback) {
        data = {
            method: 'kiwi',
            args: {
                target: target,
                data: data
            }
        };

        this.sendData(data, callback);
    };
})());
/*jslint white:true, regexp: true, nomen: true, devel: true, undef: true, browser: true, continue: true, sloppy: true, forin: true, newcap: true, plusplus: true, maxerr: 50, indent: 4 */
/*global kiwi */

kiwi.view = {};

kiwi.view.MemberList = Backbone.View.extend({
    tagName: "ul",
    events: {
        "click .nick": "nickClick"
    },
    initialize: function (options) {
        this.model.bind('all', this.render, this);
        $(this.el).appendTo('#memberlists');
    },
    render: function () {
        var $this = $(this.el);
        $this.empty();
        this.model.forEach(function (member) {
            $('<li><a class="nick"><span class="prefix">' + member.get("prefix") + '</span>' + member.get("nick") + '</a></li>')
                .appendTo($this)
                .data('member', member);
        });
    },
    nickClick: function (x) {
        var target = $(x.currentTarget).parent('li'),
            member = target.data('member'),
            userbox = new kiwi.view.UserBox();
        
        userbox.member = member;
        $('.userbox', this.$el).remove();
        target.append(userbox.$el);
    },
    show: function () {
        $('#memberlists').children().removeClass('active');
        $(this.el).addClass('active');
    }
});


kiwi.view.UserBox = Backbone.View.extend({
    // Member this userbox is relating to
    member: {},

    events: {
        'click .query': 'queryClick',
        'click .info': 'infoClick'
    },

    initialize: function () {
        this.$el = $($('#tmpl_userbox').html());
    },

    queryClick: function (event) {
        var panel = new kiwi.model.Channel({name: this.member.get('nick')});
        kiwi.app.panels.add(panel);
        panel.view.show();
    },

    infoClick: function (event) {
        kiwi.gateway.raw('WHOIS ' + this.member.get('nick'));
    }
});


kiwi.view.ServerSelect = Backbone.View.extend({
    events: {
        'submit form': 'submitLogin',
        'click .show_more': 'showMore'
    },

    initialize: function () {
        this.$el = $($('#tmpl_server_select').html());

        kiwi.gateway.bind('onconnect', this.networkConnected, this);
        kiwi.gateway.bind('connecting', this.networkConnecting, this);
    },

    submitLogin: function (event) {
        var values = {
            nick: $('.nick', this.$el).val(),
            server: $('.server', this.$el).val(),
            channel: $('.channel', this.$el).val()
        };

        this.trigger('server_connect', values);
        return false;
    },

    showMore: function (event) {
        $('.more', this.$el).slideDown('fast');
    },

    populateFields: function (defaults) {
        var nick, server, channel;

        defaults = defaults || {};

        nick = defaults.nick || '';
        server = defaults.server || '';
        channel = defaults.channel || '';

        $('.nick', this.$el).val(nick);
        $('.server', this.$el).val(server);
        $('.channel', this.$el).val(channel);
    },

    hide: function () {
        this.$el.slideUp();
    },

    show: function () {
        this.$el.show();
        $('.nick', this.$el).focus();
    },

    setStatus: function (text, class_name) {
        $('.status', this.$el)
            .text(text)
            .attr('class', 'status')
            .addClass(class_name)
            .show();
    },
    clearStatus: function () {
        $('.status', this.$el).hide();
    },

    networkConnected: function (event) {
        this.setStatus('Connected :)', 'ok');
        $('form', this.$el).hide();
    },

    networkConnecting: function (event) {
        this.setStatus('Connecting..', 'ok');
    }
});


kiwi.view.Panel = Backbone.View.extend({
    tagName: "div",
    className: "messages",
    events: {
        "click .chan": "chanClick"
    },

    // The container this panel is within
    $container: null,

    initialize: function (options) {
        this.initializePanel(options);
    },

    initializePanel: function (options) {
        this.$el.css('display', 'none');

        // Containing element for this panel
        if (options.container) {
            this.$container = $(options.container);
        } else {
            this.$container = $('#panels .container1');
        }

        this.$el.appendTo(this.$container);

        this.model.bind('msg', this.newMsg, this);
        this.msg_count = 0;

        this.model.set({"view": this}, {"silent": true});
    },

    render: function () {
        this.$el.empty();
        this.model.get("backscroll").forEach(this.newMsg);
    },
    newMsg: function (msg) {
        // TODO: make sure that the message pane is scrolled to the bottom (Or do we? ~Darren)
        var re, line_msg, $this = this.$el;

        // Make the channels clickable
        // TODO: HTML parsing may be going into the model.. move this?
        re = new RegExp('\\B(' + kiwi.gateway.channel_prefix + '[^ ,.\\007]+)', 'g');
        msg.msg = msg.msg.replace(re, function (match) {
            return '<a class="chan">' + match + '</a>';
        });

        // Build up and add the line
        line_msg = '<div class="msg <%= type %>"><div class="time"><%- time %></div><div class="nick"><%- nick %></div><div class="text" style="<%= style %>"><%= msg %> </div></div>';
        $this.append(_.template(line_msg, msg));

        this.scrollToBottom();

        // Make sure our DOM isn't getting too large (Acts as scrollback)
        this.msg_count++;
        if (this.msg_count > 250) {
            $('.msg:first', this.div).remove();
            this.msg_count--;
        }
    },
    chanClick: function (x) {
        console.log(x);
    },
    show: function () {
        var $this = this.$el;

        // Hide all other panels and show this one
        this.$container.children().css('display', 'none');
        $this.css('display', 'block');

        // Show this panels memberlist
        var members = this.model.get("members");
        if (members) {
            members.view.show();
            this.$container.parent().css('right', '200px');
        } else {
            // Memberlist not found for this panel, hide any active ones
            $('#memberlists').children().removeClass('active');
            this.$container.parent().css('right', '0');
        }

        this.scrollToBottom();

        this.trigger('active', this.model);
        kiwi.app.panels.trigger('active', this.model);
    },


    // Scroll to the bottom of the panel
    scrollToBottom: function () {
        // TODO: Don't scroll down if we're scrolled up the panel a little
        this.$container[0].scrollTop = this.$container[0].scrollHeight;
    }
});

kiwi.view.Channel = kiwi.view.Panel.extend({
    initialize: function (options) {
        this.initializePanel(options);
        this.model.bind('change:topic', this.topic, this);
    },

    topic: function (topic) {
        if (typeof topic !== 'string' || !topic) {
            topic = this.model.get("topic");
        }
        
        this.model.addMsg('', '=== Topic for ' + this.model.get('name') + ' is: ' + topic, 'topic');

        // If this is the active channel then update the topic bar
        if (kiwi.app.panels.active === this) {
            kiwi.app.topicbar.setCurrentTopic(this.model.get("topic"));
        }
    }
});

// Model for this = kiwi.model.PanelList
kiwi.view.Tabs = Backbone.View.extend({
    events: {
        "click li": "tabClick",
        'click li img': 'partClick'
    },

    initialize: function () {
        this.model.on("add", this.panelAdded, this);
        this.model.on("remove", this.panelRemoved, this);
        this.model.on("reset", this.render, this);
    },
    render: function () {
        var that = this;
        $this = $(this.el);
        $this.empty();
        
        // Add the server tab first
        $('<li><span>' + kiwi.gateway.get('name') + '</span></li>')
            .data('panel_id', this.model.server.cid)
            .appendTo($this);

        this.model.forEach(function (panel) {
            // If this is the server panel, ignore as it's already added
            if (panel == that.model.server) return;

            $('<li><span>' + panel.get("name") + '</span></li>')
                .data('panel_id', panel.cid)
                .appendTo($this);
        });
    },

    panelAdded: function (panel) {
        // Add a tab to the panel
        panel.tab = $('<li><span>' + panel.get("name") + '</span></li>');
        panel.tab.data('panel_id', panel.cid)
            .appendTo(this.$el);

        panel.view.on('active', this.panelActive, this);
    },
    panelRemoved: function (panel) {
        panel.tab.remove();
        delete panel.tab;
    },

    panelActive: function (panel) {
        // Remove any existing tabs or part images
        $('img', this.$el).remove();
        this.$el.children().removeClass('active');

        panel.tab.addClass('active');
        panel.tab.append('<img src="img/redcross.png" />');
    },

    tabClick: function (e) {
        var panel = this.model.getByCid($(e.currentTarget).data('panel_id'));
        if (!panel) {
            // A panel wasn't found for this tab... wadda fuck
            return;
        }

        panel.view.show();
    },

    partClick: function (e) {
        var panel = this.model.getByCid($(e.currentTarget).parent().data('panel_id'));

        // Only need to part if it's a channel
        if (panel.isChannel()) {
            kiwi.gateway.part(panel.get('name'));
        } else {
            panel.close();
        }
    }
});



kiwi.view.TopicBar = Backbone.View.extend({
    events: {
        'keydown input': 'process'
    },

    initialize: function () {
        kiwi.app.panels.bind('active', function (active_panel) {
            this.setCurrentTopic(active_panel.get('topic'));
        }, this);
    },

    process: function (ev) {
        var inp = $(ev.currentTarget),
            inp_val = inp.val();

        if (ev.keyCode !== 13) return;

        if (kiwi.app.panels.active.isChannel()) {
            kiwi.gateway.topic(kiwi.app.panels.active.get('name'), inp_val);
        }
    },

    setCurrentTopic: function (new_topic) {
        $('input', this.$el).val(new_topic);
    }
});



kiwi.view.ControlBox = Backbone.View.extend({
    buffer: [],  // Stores previously run commands
    buffer_pos: 0,  // The current position in the buffer

    events: {
        'keydown input': 'process'
    },

    initialize: function () {
        var cb = this; // TODO: Why is `that` not recognised in the below closure?
        that = this;

        kiwi.gateway.bind('change:nick', function () {
            $('.nick', cb.$el).text(this.get('nick'));
        });
    },

    process: function (ev) {
        var inp = $(ev.currentTarget),
            inp_val = inp.val();

        switch (true) {
        case (ev.keyCode === 13):              // return
            inp_val = inp_val.trim();

            if (inp_val) {
                this.processInput(inp.val());

                this.buffer.push(inp.val());
                this.buffer_pos = this.buffer.length;
            }

            inp.val('');

            break;

        case (ev.keyCode === 38):              // up
            if (this.buffer_pos > 0) {
                this.buffer_pos--;
                inp.val(this.buffer[this.buffer_pos]);
            }
            break;

        case (ev.keyCode === 40):              // down
            if (this.buffer_pos < this.buffer.length) {
                this.buffer_pos++;
                inp.val(this.buffer[this.buffer_pos]);
            }
        }
    },


    processInput: function (command_raw) {
        var command,
            params = command_raw.split(' ');
        
        // Extract the command and parameters
        if (params[0][0] === '/') {
            command = params[0].substr(1).toLowerCase();
            params = params.splice(1);
        } else {
            // Default command
            command = 'msg';
            params.unshift(kiwi.app.panels.active.get('name'));
        }

        // Trigger the command events
        this.trigger('command', {command: command, params: params});
        this.trigger('command_' + command, {command: command, params: params});

        // If we didn't have any listeners for this event, fire a special case
        // TODO: This feels dirty. Should this really be done..?
        if (!this._callbacks['command_' + command]) {
            this.trigger('unknown_command', {command: command, params: params});
        }
    }
});





// This *may* be needed in future
kiwi.view.Application = Backbone.View.extend({
    initialize: function () {
        $(window).resize(this.doLayout);
        $('#toolbar').resize(this.doLayout);
        $('#controlbox').resize(this.doLayout);

        this.doLayout();

        $(window).keydown(this.setKeyFocus);
    },


    // Globally shift focus to the command input box on a keypress
    setKeyFocus: function (ev) {
        // If we're copying text, don't shift focus
        if (ev.ctrlKey || ev.altKey) {
            return;
        }

        // If we're typing into an input box somewhere, ignore
        if (ev.srcElement.tagName.toLowerCase() === 'input') {
            return;
        }

        $('#controlbox .inp').focus();
    },


    doLayout: function () {
        var el_panels = $('#panels');
        var el_memberlists = $('#memberlists');
        var el_toolbar = $('#toolbar');
        var el_controlbox = $('#controlbox');

        var css_heights = {
            top: el_toolbar.outerHeight(true),
            bottom: el_controlbox.outerHeight(true)
        };

        el_panels.css(css_heights);
        el_memberlists.css(css_heights);
    },


    barsHide: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideUp();
            $('#controlbox').slideUp(function () { that.doLayout(); });
        } else {
            $('#toolbar').slideUp(0);
            $('#controlbox').slideUp(0);
        }
    },

    barsShow: function (instant) {
        var that = this;

        if (!instant) {
            $('#toolbar').slideDown();
            $('#controlbox').slideDown(function () { that.doLayout(); });
        } else {
            $('#toolbar').slideDown(0);
            $('#controlbox').slideDown(0);
            this.doLayout();
        }
    }
});
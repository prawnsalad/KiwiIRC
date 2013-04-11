// ==UserScript==
// @name           Includes : Persist BETA
// @namespace      http://gm.wesley.eti.br
// @description    Persist Function
// @author         w35l3y
// @email          w35l3y@brasnet.org
// @copyright      2013+, w35l3y (http://gm.wesley.eti.br)
// @license        GNU GPL
// @homepage       http://gm.wesley.eti.br
// @version        1.0.1.0
// @language       en
// @include        nowhere
// @exclude        *
// @require        http://userscripts.org/scripts/source/63808.user.js
// ==/UserScript==

/**************************************************************************

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

**************************************************************************/

var Persist = function (s) {
	var service = Persist.services[s];

	this.request = function (obj) {
		var k,
		xthis = this,
		params = function (def) {
			var list = {};

			this.add = function (vars) {
				if (vars) {
					if (typeof vars == "object") {
						for (var k in vars) {
							var e = vars[k];

							if (typeof e == "object" && (!/^(?:radio|checkbox)$/i.test(e.type) || e.checked)) {
								var n = e.name || k;

								if (e.checked && /^checkbox$/i.test(e.type)) {
									if (n in list) {
										list[n].push(e.value);
									} else {
										list[n] = [e.value];
									}
								} else if ("value" in e) {
									list[n] = e.value;
								} else {
									list[n] = e;
								}
							} else {
								list[k] = e;
							}
						}
					} else {
						list = vars;
					}
				}
			};

			this.toString = function() {
				if (typeof list == "object") {
					var data = "";
					for (var key in list) {
						if (list[key] instanceof Array) {
							var keyarr = key.replace(/^\s+|\s+$/g, "");
							if (!/\[\w*\]$/.test(key)) keyarr += "[]";

							for (var k in list[key]) {
								var v = list[key][k];
								data += "&" + encodeURIComponent(keyarr) + "=" + encodeURIComponent(v);
							}
						} else {
							data += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(list[key]);
						}
					}

					return data.substr(1);
				} else {
					return list;
				}
			};
		},
		data = new params();

		data.add(obj.pdata);
		data.add(obj.adata);
		data.add(obj.data);
		data.add(obj.odata);

		if (typeof obj.onload != "function") {
			obj.onload = function (obj) {
				console.log(["request.load", obj]);
			};
		}

		if (typeof obj.onerror != "function") {
			obj.onerror = function (obj) {
				console.log(["request.error", obj]);
			};
		}

		var update = function (obj, e) {
			obj.response = {
				raw	: function () {return e;},
				text	: function () {return e.responseText;},
				json	: function () {
					try {
						return JSON.parse(e.responseText);
					} catch (x) {
						return eval("(" + e.responseText + ")");
					}
				},
				doc	: function () {
					try {
						return new DOMParser().parseFromString(e.responseText, /^Content-Type: ([\w/]+)$/mi.test(e.responseHeaders) && RegExp.$1 || "text/html");
					} catch (x) {
						var doc = document.implementation.createHTMLDocument("");
						doc.documentElement.innerHTML = e.responseText;

						return doc;
					}
				},
			};
			obj.value = e.responseText;
		},
		params = {
			url		: obj.url,
			method	: obj.method,
			onload	: function (e) {
				update(obj, e);

				obj[(/^2/.test(e.status)?"onload":"onerror")].apply(xthis, [obj]);
			},
			onerror	: function (e) {
				update(obj, e);

				obj.onerror.apply(xthis, [obj]);
			}
		},
		sdata = data.toString();

		if (/^post$/i.test(obj.method)) {
			var p = {
				headers	: {
					"Content-Type"	: "application/x-www-form-urlencoded"
				},
				data	: sdata,
			};

			console.log(sdata);

			for (k in p) {
				params[k] = p[k];
			}
		} else if (sdata) {
			params.url += "?" + sdata;

		}

		if (typeof obj.headers == "object")
		for (k in obj.headers) {
			params.headers[k] = obj.headers[k];
		}

		return GM_xmlhttpRequest(params);
	};

	for (var k in service) {
		this[k] = service[k];
	}
};

						api_dev_key     : "32d77df195e6059aaebbb72f75723505"
						api_user_key    : "d6cc83827de4d3912a955ba81556e763"
Persist.services	= {
	LOCAL		: {
		write	: function (obj) {
			var label_keys = "persist_keys-" + obj.service,
			label_data = "persist_data-" + obj.service,
			mapping = JSON.parse(GM_getValue(label_keys, "{}")),
			data = JSON.parse(GM_getValue(label_data, "[]")),
			key = obj.key;

			if (key in mapping) {
				key = mapping[obj.key];
			}

			if (key in data) {
				var tv = typeof obj.value,
				td = typeof data[key];

				if ((td != tv) && (td == "object" || tv == "object")) {
					throw ["Incompatible types ", td, tv].toString();
				} else {
					switch (td) {
						case "string":
							if (-1 == obj.mode) {	// prepend
								data[key] = obj.value + data[key];
							} else if (1 == obj.mode) {	// append
								data[key] += obj.value;
							} else {	// overwrite (default)
								data[key] = obj.value;
							}
							break;
						case "boolean":
							if (-1 == obj.mode) {	// unused
								throw ["Reserved action"].toString();
							} else if (1 == obj.mode) {	// toggle
								data[key] = !data[key];
							} else {	// overwrite (default)
								data[key] = !!value;
							}
							break;
						case "number":
							var value = Number(obj.value);

							if (-1 == obj.mode) {	// subtract
								data[key] -= value;
							} else if (1 == obj.mode) {	// add
								data[key] += value;
							} else {	// overwrite (default)
								data[key] = value;
							}
							break;
						case "object":
							if (-1 == obj.mode) {	// prepend
								for (var k in data[key]) {
									obj.value[k] = data[key][k];
								}
								data[key] = obj.value;
							} else if (1 == obj.mode) {	// append
								for (var k in obj.value) {
									data[key][k] = obj.value[k];
								}
							} else {	// overwrite (default)
								data[key] = obj.value;
							}
							break;
						default:
							throw ["Unsupported type " + td, data[key], key].toString();
					}

					obj.value = data[key];
				}
			} else {
				var tkey = data.push(obj.value);

				if (--tkey != key) {
					if ("key" in obj) {
						if (key in mapping) {
							console.log(["Wrong mapping... ", tkey, key]);
						}

						mapping[key] = tkey;
						obj.key = key;

						GM_setValue(label_keys, JSON.stringify(mapping));
					} else {
						obj.key = tkey;
					}
				}
			}

			GM_setValue(label_data, JSON.stringify(data));

			if (typeof obj.onload != "function") {
				obj.onload = function (obj) {
					console.log(["write.load", obj]);
				};
			}

			return obj.onload.apply(this, [obj]);
		},
		delete	: function (obj) {
			throw ["Not implemented"].toString();
		},
		read	: function (obj) {
			var mapping = JSON.parse(GM_getValue("persist_keys-" + obj.service, "{}")),
			key = obj.key;

			if (key in mapping) {
				key = mapping[key];
			}

			obj.value = JSON.parse(GM_getValue("persist_data-" + obj.service, "[]"))[key];

			if (typeof obj.onload != "function") {
				obj.onload = function (obj) {
					console.log(["read.load", obj]);
				};
			}

			return obj.onload.apply(this, [obj]);
		},
	},
	PASTEBIN	: {
		write	: function (obj) {
			var execute = function (x) {
				var onload = x.onload,
				value = x.value,
				xthis = this,
				p = {
					url		: "http://pastebin.com/api/api_post.php",
					method	: "post",
					pdata		: {
						api_paste_format		: "text",
						api_paste_private		: "1",
						api_paste_expire_date	: "N",
						api_paste_code		: x.value,	// required
					},
					odata		: {
						api_paste_key		: obj.key,
						api_option			: "paste"
					},
					onload	: function (y) {
						if (/^https?:\/\//i.test(y.value) && /\w+$/.test(y.value)) {
							var key = x.key;
							x.key = RegExp["$&"];

							x.onload = onload;
							x.value = value;

							x.onload.apply(xthis, [x]);

							if (x.read) {
								/* It is implemented that way because currently there isn't an EDIT option via API */
								y.key = key;
								y.onload = function (z) {
									console.log(["delete.load", z]);
								};
								y.onerror = function (z) {
									console.log(["delete.error", z]);
								};

								xthis.delete.apply(xthis, [y]);
							}
						} else {
							x.onerror.apply(xthis, [x]);
						}
					}
				};

				for (var i in p) {
					x[i] = p[i];
				}

				return this.request(x);
			};

			if (1 == Math.abs(obj.mode)) {	// prepend or append
				var value = obj.value,
				onload = obj.onload,
				xthis = this;

				obj.onload = function (x) {
					obj.onload = onload;

					if (-1 == obj.mode) {	// prepend
						obj.value = value + obj.value;
					} else {	// append
						obj.value += value;
					}

					return execute.apply(xthis, [obj]);
				};

				return this.read.apply(this, [obj]);
			} else {
				return execute.apply(this, [obj]);
			}
		},
		read	: function (obj) {
			if ("key" in obj) {
				var onload = obj.onload,
				xthis = this,
				p = {
					read		: false,
					url		: "http://pastebin.com/download.php",
					method	: "get",
					adata		: {
						i	: obj.key
					},
					onload	: function (x) {
						obj.onload = onload;

						if (x.response.raw().finalUrl.indexOf(x.url)) {
							obj.value = "";

							obj[typeof obj.onwarn == "function"?"onwarn":"onload"].apply(this, [obj]);
						} else {
							obj.read = true;

							obj.onload.apply(xthis, [obj]);
						}
					}
				};
				for (var i in p) {
					obj[i] = p[i];
				}

				return this.request(obj);
			} else {
				obj.value = "";
				obj.read = false;

				obj[typeof obj.onwarn == "function"?"onwarn":"onload"].apply(this, [obj]);
			}
		},
		delete	: function (obj) {
			var onload = obj.onload,
			value = obj.value,
			xthis = this,
			p = {
				url		: "http://pastebin.com/api/api_post.php",
				method	: "post",
				adata		: JSON.parse(GM_getValue("pastebin_adata", JSON.stringify({
//					api_dev_key			: "",	// required
//					api_user_key		: "",
				}))),
				pdata		: {},
				odata		: {
					api_paste_key		: obj.key,
					api_option			: "delete"
				},
				onload	: function (x) {
					if (/^Paste Removed$/i.test(x.value)) {
						obj.onload = onload;
						obj.value = value;

						obj.onload.apply(xthis, [obj]);
					} else {
						obj.onerror.apply(xthis, [obj]);
					}
				}
			};

			for (var i in p) {
				obj[i] = p[i];
			}

			return this.request(obj);
		},
	},
	PASTEBIN2	: {
		write	: function (obj) {
			var ovalue = obj.value,
			xthis = this,
			execute = function (x) {
				var onload = x.onload,
				nvalue = x.value,
				p = {
					method	: "post",
					adata	: JSON.parse(GM_getValue("pastebin2_adata", JSON.stringify({
//						paste_private		: "1",
					}))),
					pdata	: {
						paste_format		: "1",
						paste_private		: "2",
						paste_expire_date	: "N",
						paste_code			: x.value,	// required
					},
					odata	: {
						submit			: "Submit",
						submit_hidden	: "submit_hidden",
						item_key		: obj.key,
						post_key		: obj.key,
					},
					onload	: function (y) {
						var doc = y.response.doc(),
						url = y.response.raw().finalUrl;

						if (/warning\.php\?p=(\d+)/i.test(url)) {
							x.code = RegExp.$1 - 1;
							x.value = [
								"You have reached your limit of [10] pastes per 24 hours.",
								"You have reached your limit of [20] pastes per 24 hours.",
								"You have reached your limit of [250] pastes per 24 hours.",
							][x.code] || xpath("string(id('content_left')/div[2])", doc) || "Unknown error (WARN " + x.code + ")";

							x.onerror.apply(xthis, [x]);
						} else if ((/^https?:/i.test(url)) && (/\/(\w+)$/.test(url))) {
							x.key = RegExp.$1;

							if (xpath("string(.//text()[contains(., 'Pastebin.com is under heavy load right now')])", doc)) {
								x.onerror.apply(xthis, [x]);
							} else {
								if (xpath("id('siimage')", doc)[0]) {
									x.value = nvalue;
									GM_log(ovalue);
									alert("A new window will be opened. You must fill the captcha correctly, otherwise you will lose your data and a new paste will be created next time.");
									GM_openInTab(url);
								} else {
									var code = xpath("id('paste_code')", doc)[0];
									x.value = code && code.textContent || "";
								}
								x.onload = onload;
								x.onload.apply(xthis, [x]);
							}
						} else {
							x.value = [
								"You have exceeded the maximum file size of [500] kilobytes per paste.",
								"You cannot create an empty paste.",
								"You have reached the maximum number of [25] unlisted pastes.",
								"You have reached the maximum number of [10] private pastes.",
							][/index\.php\?e=(\d+)/.test(url) && (x.code = RegExp.$1 - 1)] || xpath("string(id('notice'))", doc) || "Unknown error (ERROR " + x.code + ")";

							x.onerror.apply(xthis, [x]);
						}
					}
				};

				for (var i in p) {
					x[i] = p[i];
				}

				return this.request(x);
			};

			if (1 == Math.abs(obj.mode)) {	// prepend or append
				var onload = obj.onload;

				if ("" != ovalue) {
					obj.onload = function (x) {
						obj.onload = onload;

						if (-1 == obj.mode) {	// prepend
							obj.value = ovalue + obj.value;
						} else {	// append
							obj.value += ovalue;
						}

						return execute.apply(xthis, [obj]);
					};
				}

				return xthis.read.apply(xthis, [obj]);
			} else {
				return execute.apply(xthis, [obj]);
			}
		},
		read	: function (obj) {
			var xthis = this;

			if ("key" in obj && obj.key) {
				var onload = obj.onload,
				p = {
					read		: false,
					url		: "http://pastebin.com/download.php",
					method	: "get",
					adata		: {
						i	: obj.key
					},
					onload	: function (x) {
						var url = x.response.raw().finalUrl;

						x.onload = onload;

						if (url.indexOf(x.url)) {	// Unknown Paste ID
							x.value = "";
							x.url = "http://pastebin.com/post.php";
							x.key = "";

							x[typeof x.onwarn == "function"?"onwarn":"onload"].apply(this, [x]);
						} else if (~x.value.indexOf("this is a private paste. If this is your private paste")) {	// may occur false positive
							x.value = "This is a private paste (#"+x.key+"). You must login to Pastebin first.";
							x.onerror.apply(xthis, [x]);
						} else if (~x.value.indexOf("Pastebin.com is under heavy load right now")) {
							x.value = "Pastebin.com is under heavy load right now.";
							x.onerror.apply(xthis, [x]);
						} else {
							x.read = true;
							x.url = "http://pastebin.com/edit.php";

							x.onload.apply(xthis, [x]);
						}
					}
				};
				for (var i in p) {
					obj[i] = p[i];
				}

				return this.request(obj);
			} else {
				obj.read = false;
				obj.url = "http://pastebin.com/post.php";
				obj.key = "";

				this.request({
					url		: "http://pastebin.com/",
					method	: "get",
					onload	: function (c) {
						if (xpath("boolean(id('header_bottom')//a[contains(@href, '/logout')])", c.response.doc())) {
							obj.value = "";

							obj[typeof obj.onwarn == "function"?"onwarn":"onload"].apply(xthis, [obj]);
						} else {
							obj.value = "You must login to Pastebin first.";

							obj.onerror.apply(xthis, [obj]);
						}
					},
					onerror	: function (c) {
						c.value = xpath("string(id('content_left')/div[1])", c.response.doc());

						obj.onerror(c);
					},
				});
			}
		},
		delete	: function (obj) {
			var onload = obj.onload,
			value = obj.value,
			xthis = this,
			p = {
				url		: "http://pastebin.com/delete.php",
				method	: "get",
				adata	: {},
				pdata	: {},
				odata	: {
					i	: obj.key,
					r	: "/" + obj.key
				},
				onload	: function (x) {
					if (/^Paste Removed$/i.test(x.value)) {
						obj.onload = onload;
						obj.value = value;

						obj.onload.apply(xthis, [obj]);
					} else {
						obj.onerror.apply(xthis, [obj]);
					}
				}
			};

			for (var i in p) {
				obj[i] = p[i];
			}

			return this.request(obj);
		}
	}
};

Persist.write = function (obj) {
	var p = new Persist(obj.service);

	return p.write.apply(p, [obj]);
};

Persist.delete = function (obj) {
	var p = new Persist(obj.service);

	return p.delete.apply(p, [obj]);
};

Persist.read = function (obj) {
	var p = new Persist(obj.service);

	return p.read.apply(p, [obj]);
};
// ==UserScript==
// @name           Includes : XPath
// @namespace      http://gm.wesley.eti.br/includes
// @description    xpath Function
// @author         w35l3y
// @email          w35l3y@brasnet.org
// @copyright      2009+, w35l3y (http://gm.wesley.eti.br)
// @license        GNU GPL
// @homepage       http://gm.wesley.eti.br
// @version        1.0.0.5
// @language       en
// @include        nowhere
// ==/UserScript==

/**************************************************************************

	Author 's NOTE

    Original http://lowreal.net/blog/2007/11/17/1

***************************************************************************

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

**************************************************************************/

XPath = Xpath = xpath = function()
{
	var a = Array.prototype.slice.call(arguments),	// args
	e = a[0],	// expression
	c = a[1],	// context
	t = a[2];	// type
	
	if (typeof c == "function")
	{
		t = c;
		c = null;
	}
	if (!c)
	c = document.documentElement||document;
	var d = c.ownerDocument || c;
	e = d.createExpression(e, function(p)
	{
       	var o = d.createNSResolver(c).lookupNamespaceURI(p);

		if (o)
		return o;
		else switch (c.contentType)
		{
			case "text/xhtml":
			case "application/xhtml+xml":
				return "http://www.w3.org/1999/xhtml";
			default:
				return "";
		}
	});

	switch (t)
	{
		case String:
			return e.evaluate(c, XPathResult.STRING_TYPE, null).stringValue;
		case Number:
			return e.evaluate(c, XPathResult.NUMBER_TYPE, null).numberValue;
		case Boolean:
			return e.evaluate(c, XPathResult.BOOLEAN_TYPE, null).booleanValue;
		case Array:
			var r = e.evaluate(c, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null),
			o = [];

			for ( var ai = 0 , at = r.snapshotLength ; ai < at ; ++ai )
				o.push(r.snapshotItem(ai));

			return o;
		case undefined:
			var r = e.evaluate(c, XPathResult.ANY_TYPE, null);
			switch (r.resultType)
			{
				case XPathResult.STRING_TYPE:
					return r.stringValue;
				case XPathResult.NUMBER_TYPE:
					return r.numberValue;
				case XPathResult.BOOLEAN_TYPE:
					return r.booleanValue;
				case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
					var o = [], i;
					while (i = r.iterateNext())
						o.push(i);

					return o;
			}
			return null;
		default:
			throw(TypeError("xpath: specified type is not valid type."));
	}
};
Persist = {};
Persist.get = function (key, value) {
	console.log("Get", key, value);
	if(Persist.persistable()){
		return localStorage[key] || value;
	}	
};
Persist.set = function (key, value) {
	console.log("Set", key, value);
	if(Persist.persistable()){
		localStorage[key] = value;
	}	
};

Persist.persistable = function(){
  try {
    return 'localStorage' in window && window['localStorage'] !== null;
  } catch (e) {
    return false;
  }
}

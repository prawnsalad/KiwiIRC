/*jslint browser: true, devel: true, sloppy: true, plusplus: true, nomen: true, forin: true, continue: true */
/*globals kiwi, $, _, Tabview, Userlist, User, Box */
/**
*   @namespace
*/
kiwi.front.ui = {

    /**
    *
    */
    doLayoutSize: function () {
        var kiwi, toolbars, ul, n_top, n_bottom, nl;
        kiwi = $('#kiwi');

        if (kiwi.width() < 330 && !kiwi.hasClass('small_kiwi')) {
            console.log("switching to small kiwi");
            kiwi.removeClass('large_kiwi');
            kiwi.addClass('small_kiwi');
        } else if (kiwi.width() >= 330 && !kiwi.hasClass('large_kiwi')) {
            kiwi.removeClass('small_kiwi');
            kiwi.addClass('large_kiwi');
        }

        toolbars = $('#kiwi .toolbars');
        ul = $('#kiwi .userlist');

        n_top = parseInt(toolbars.offset().top, 10) + parseInt(toolbars.outerHeight(true), 10);
        n_bottom = $(document).height() - parseInt($('#kiwi .control').offset().top, 10);

        $('#kiwi .windows').css({top: n_top + 'px', bottom: n_bottom + 'px'});
        ul.css({top: n_top + 'px', bottom: n_bottom + 'px'});

        nl = $('#nicklist_resize');
        nl.css({top: n_top + 'px', bottom: n_bottom + 'px', left: $(document).width() - ul.outerWidth(true)});
    },

    /**
    *
    */
    doLayout: function () {
        $('#kiwi .msginput .nick a').text(kiwi.gateway.nick);
        $('#kiwi_msginput').val(' ');
        $('#kiwi_msginput').focus();
    },

    /**
    *   Binds keyboard and mouse events to handlers
    */
    registerKeys: function () {
        var tabcomplete = {active: false, data: [], prefix: ''};
        $('#kiwi_msginput').bind('keydown', function (e) {
            var windows, meta, num, msg, data, self;
            windows = $('#windows');

            if (navigator.appVersion.indexOf("Mac") !== -1) {
                meta = e.ctrlKey;
            } else {
                meta = e.altKey;
            }

            if (e.which !== 9) {
                tabcomplete.active = false;
                tabcomplete.data = [];
                tabcomplete.prefix = '';
            }

            switch (true) {
            case (e.which >= 48) && (e.which <= 57):
                if (meta) {
                    num = e.which - 48;
                    if (num === 0) {
                        num = 10;
                    }
                    num = num - 1;
                    kiwi.front.ui.windowsShow(num);
                    return false;
                }
                break;
            case e.which === 27:            // escape                    
                return false;
            case e.which === 13:            // return
                msg = $('#kiwi_msginput').val();
                msg = msg.trim();

                kiwi.front.buffer.push(msg);
                kiwi.front.buffer_pos = kiwi.front.buffer.length;

                kiwi.front.run(msg);
                $('#kiwi_msginput').val('');

                break;
            case e.which === 33:             // page up
                console.log("page up");
                windows[0].scrollTop = windows[0].scrollTop - windows.height();
                return false;
            case e.which === 34:             // page down
                windows[0].scrollTop = windows[0].scrollTop + windows.height();
                return false;
            case e.which === 37:            // left
                if (meta) {
                    kiwi.front.ui.windowsPrevious();
                    return false;
                }
                break;
            case e.which === 38:            // up
                if (kiwi.front.buffer_pos > 0) {
                    kiwi.front.buffer_pos--;
                    $('#kiwi_msginput').val(kiwi.front.buffer[kiwi.front.buffer_pos]);
                }
                break;
            case e.which === 39:            // right
                if (meta) {
                    kiwi.front.ui.windowsNext();
                    return false;
                }
                break;
            case e.which === 40:            // down
                if (kiwi.front.buffer_pos < kiwi.front.buffer.length) {
                    kiwi.front.buffer_pos++;
                    $('#kiwi_msginput').val(kiwi.front.buffer[kiwi.front.buffer_pos]);
                }
                break;

            case e.which === 9:                // tab
                tabcomplete.active = true;
                if (_.isEqual(tabcomplete.data, [])) {
                    // Get possible autocompletions
                    data = [];
                    $.each(Tabview.getCurrentTab().userlist.listUsers(false), function () {
                        var nick;
                        nick = User.stripPrefix(this.nick);
                        data.push(nick);
                    });
                    data = _.sortBy(data, function (nick) {
                        return nick;
                    });
                    tabcomplete.data = data;
                }

                if (this.value[this.selectionStart - 1] === ' ') {
                    return false;
                }
                self = this;
                (function () {
                    var tokens = self.value.substring(0, self.selectionStart).split(" "),
                        val,
                        p1,
                        newnick,
                        range,
                        nick = tokens[tokens.length - 1];
                    if (tabcomplete.prefix === '') {
                        tabcomplete.prefix = nick;
                    }

                    tabcomplete.data = _.select(tabcomplete.data, function (n) {
                        return (n.toLowerCase().indexOf(tabcomplete.prefix.toLowerCase()) === 0);
                    });

                    if (tabcomplete.data.length > 0) {
                        p1 = self.selectionStart - (nick.length);
                        val = self.value.substr(0, p1);
                        newnick = tabcomplete.data.shift();
                        tabcomplete.data.push(newnick);
                        val += newnick;
                        val += self.value.substr(self.selectionStart);
                        self.value = val;
                        if (self.setSelectionRange) {
                            self.setSelectionRange(p1 + newnick.length, p1 + newnick.length);
                        } else if (self.createTextRange) { // not sure if this bit is actually needed....
                            range = self.createTextRange();
                            range.collapse(true);
                            range.moveEnd('character', p1 + newnick.length);
                            range.moveStart('character', p1 + newnick.length);
                            range.select();
                        }
                    }
                }());
                return false;
            }
        });


        $('#kiwi .control .msginput .nick').click(function () {
            kiwi.front.ui.showChangeNick();
        });





        $('#kiwi .plugins .load_plugin_file').click(function () {
            if (typeof kiwi.front.boxes.plugins !== "undefined") {
                return;
            }

            kiwi.front.boxes.plugins = new Box("plugin_file");
            $('#tmpl_plugins').tmpl({}).appendTo(kiwi.front.boxes.plugins.content);
            kiwi.front.boxes.plugins.box.css('top', -(kiwi.front.boxes.plugins.height + 40));

            // Populate the plugin list..
            function enumPlugins() {
                var lst, j, txt;
                lst = $('#plugin_list');
                lst.find('option').remove();
                for (j in kiwi.plugs.loaded) {
                    txt = kiwi.plugs.loaded[j].name;
                    lst.append('<option value="' + txt + '">' + txt + '</option>');
                }
            }
            enumPlugins();

            // Event bindings
            $('#kiwi .plugin_file').submit(function () {
                $('<div></div>').load($('.txtpluginfile').val(), function (e) {
                    enumPlugins();
                });
                return false;
            });
            $('#kiwi .cancelpluginfile').click(function () {
                kiwi.front.boxes.plugins.destroy();
            });

            $('#kiwi #plugins_list_unload').click(function () {
                var selected_plugin;
                selected_plugin = $('#plugin_list').val();
                kiwi.plugs.unloadPlugin(selected_plugin);
                enumPlugins();
            });

            $('#kiwi .txtpluginfile').focus();

        });

        $('#kiwi .plugins .reload_css').click(function () {
            var links = document.getElementsByTagName("link"),
                i;
            for (i = 0; i < links.length; i++) {
                if (links[i].rel === "stylesheet") {
                    if (links[i].href.indexOf("?") === -1) {
                        links[i].href += "?";
                    }
                    links[i].href += "x";
                }
            }
        });


        $('#kiwi .about .about_close').click(function () {
            $('#kiwi .about').css('display', 'none');
        });


        $('#kiwi .poweredby').click(function () {
            $('#kiwi .about').css('display', 'block');
        });

    },

    /**
    *   Prevents the user from accidentally refreshing the page by pressing F5 or <meta> + R
    */
    preventRefresh: function () {
        $(document).keydown(function (e) {
            // meta + r || F5
            if ((e.metaKey && e.which === 82) || e.which === 116) {
                e.preventDefault();
                e.stopPropagation();

                // Reset IE keyCode
                event.keyCode = 0;

                return false;
            }
        });
    },

    /**
    *   Prompts user for a new nick
    */
    showChangeNick: function (caption) {
        caption = (typeof caption !== 'undefined') ? caption : '';

        $('#kiwi').append($('#tmpl_change_nick').tmpl({}));

        $('#kiwi .newnick .caption').text(caption);

        $('#kiwi .form_newnick').submit(function () {
            kiwi.front.run('/NICK ' + $('#kiwi .txtnewnick').val());
            $('#kiwi .newnick').remove();
            return false;
        });

        $('#kiwi .txtnewnick').keypress(function (ev) {
            if (!this.first_press) {
                this.first_press = true;
                return false;
            }
        });

        $('#kiwi .txtnewnick').keydown(function (ev) {
            if (ev.which === 27) {  // ESC
                $('#kiwi_msginput').focus();
                $('#kiwi .newnick').remove();
            }
        });

        $('#kiwi .cancelnewnick').click(function () {
            $('#kiwi .newnick').remove();
        });

        $('#kiwi .txtnewnick').focus();
    },


    /**
    *   Displays the current channel's topic in the topic bar
    */
    setTopicText: function (new_topic) {
        kiwi.front.cache.original_topic = new_topic;
        $('#kiwi .cur_topic .topic').text(new_topic);
        kiwi.front.ui.doLayoutSize();
    },



    /**
    *   
    */
    tabviewsNext: function () {
        var wl = $('#kiwi .windowlist ul'),
            next_left = parseInt(wl.css('text-indent').replace('px', ''), 10) + 170;
        wl.css('text-indent', next_left);
    },

    /**
    *
    */
    tabviewsPrevious: function () {
        var wl = $('#kiwi .windowlist ul'),
            next_left = parseInt(wl.css('text-indent').replace('px', ''), 10) - 170;
        wl.css('text-indent', next_left);
    },

    /**
    *   Displays the next tab
    */
    windowsNext: function () {
        /*var tab, tabs, curTab, next;
        next = false;
        tabs = Tabview.getAllTabs();
        curTab = Tabview.getCurrentTab();
        for (tab in tabs) {
            if (!next) {
                if (tabs[tab] === curTab) {
                    next = true;
                    continue;
                }
            } else {
                tabs[tab].show();
                return;
            }
        }*/
    },

    /**
    *   Displays the previous tab
    */
    windowsPrevious: function () {
        /*var tab, tabs, curTab, prev_tab, next;
        next = false;
        tabs = Tabview.getAllTabs();
        curTab = Tabview.getCurrentTab();
        for (tab in tabs) {
            if (tabs[tab] === curTab) {
                if (prev_tab) {
                    prev_tab.show();
                }
                return;
            }
            prev_tab = tabs[tab];
        }*/
    },

    /**
    *   Shows a specific tab
    *   @param  {Number}    num The index of the tab to show
    */
    windowsShow: function (num) {
        /*num = parseInt(num, 10);
        console.log('Showing window ' + num.toString());
        var i = 0, tab, tabs;
        tabs = Tabview.getAllTabs();
        for (tab in tabs) {
            if (i === num) {
                tabs[tab].show();
                return;
            }
            i++;
        }
    },


    /**
    *   
    */
    barsShow: function () {
        $('#kiwi .control').slideDown();
        $('#kiwi .toolbars').slideDown(400, function () {
            kiwi.front.ui.doLayoutSize();
        });
    },

    /**
    *
    */
    barsHide: function () {
        $('#kiwi .control').slideUp();
        $('#kiwi .toolbars').slideUp(400, function () {
            kiwi.front.ui.doLayoutSize();
        });
    },







    /**
    *   Displays the tutorial
    */
    tutorial: function () {
        var b = $('<div id="tutorial_box" style="border:3px solid blue;"></div>'),
            bounds,
            s,
            current_s,
            next_s;
        b.css({display: 'block', position: 'absolute', height: '100%', width: '100%'});
        $('#kiwi').append(b);

        /**
        *   @inner
        */
        bounds = function (el) {
            var b = 3, ret = {};
            ret.top = el.offset().top;
            ret.left = el.offset().left;
            ret.width = parseInt(el.outerWidth(true), 10) - (b * 2);
            ret.height = parseInt(el.outerHeight(true), 10) - (b * 2);
            return ret;
        };

        s = [
            function () {
                b.animate(bounds($('#kiwi .msginput')), 2000, '', next_s);
            },

            function () {
                b.animate(bounds($('#kiwi .userlist')), 2000, '', next_s);
            },

            function () {
                b.animate(bounds($('#panel1')), 2000, '', next_s);
            },

            function () {
                b.animate(bounds($('#kiwi .cur_topic')), 2000, '', next_s);
            },

            function () {
                b.animate(bounds($('#kiwi .windowlist')), 2000, '', next_s);
            }
        ];


        current_s = -1;
        /**
        *   @inner
        */
        next_s = function () {
            current_s++;
            if (typeof s[current_s] === 'function') {
                console.log('Animating ' + current_s.toString());
                s[current_s]();
            }
        };
        next_s();
    }

};
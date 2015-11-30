define('ui/controlbox/controlbox', function(require, exports, module) {

    var Application = require('ui/application/application');
    var utils = require('helpers/utils');

    module.exports = Backbone.View.extend({
        events: {
            'keydown .inp': 'inputKeyDown',
            'keyup .inp': 'inputKeyUp',
            'blur .inp': 'inputBlur',
            'click .nick': 'showNickChange'
        },

        initialize: function () {
            var that = this;

            this.buffer = [];  // Stores previously run commands
            this.buffer_pos = 0;  // The current position in the buffer

            this.preprocessor = new utils.InputPreProcessor();
            this.preprocessor.recursive_depth = 5;

            this.autocomplete = new (require('ui/autocomplete/autocomplete'))({el: this.$('.autocomplete')[0]});
            this.autocomplete_command_list = [];
            this.bindAutocomplete();

            // Keep the nick view updated with nick changes
            Application.instance().connections.on('change:nick', function(connection) {
                // Only update the nick view if it's the active connection
                if (connection !== Application.instance().connections.active_connection)
                    return;

                $('.nick', that.$el).text(connection.get('nick'));
            });

            // Update our nick view as we flick between connections
            Application.instance().connections.on('active', function(panel, connection) {
                $('.nick', that.$el).text(connection.get('nick'));
            });
        },

        render: function() {
            var send_message_text = utils.translateText('client_views_controlbox_message');
            this.$('.inp').attr('placeholder', send_message_text);

            return this;
        },

        bindAutocomplete: function() {
            this.listenTo(this.autocomplete, 'match', function(word, matched) {
                // A final word is selected. Either by clicking or hitting enter
                var trailing = '';
                if (matched.type === 'nick' && this.autocomplete_token_idx === 0) {
                    trailing = ': ';
                }
                this.autoCompleteFillWord(word + trailing, true);
                this.autocomplete.close();
            });

            this.listenTo(this.autocomplete, 'selected', function(word, matched) {
                // Words are selected while scrolling through the available options
                var trailing = '';
                if (matched && matched.type === 'nick' && this.autocomplete_token_idx === 0) {
                    trailing = ': ';
                }

                // Only display the match if we're not filtering through the UI
                if (!this.autocomplete.filter_list) {
                    this.autoCompleteFillWord(word ? word + trailing : this.autocomplete.matching_against_word, true);
                }
            });


            var focus_after_close = true;
            this.listenTo(this.autocomplete, 'cancel', function(reason) {
                var $inp = this.$('.inp'),
                    inp = $inp[0],
                    inp_val = $inp.val(),
                    caret_pos = $inp.selectRange();

                // If we hit space while typing a word, then take chars 0->caret_pos, remove rest of word, include rest of input value
                if (reason === 'typing' || reason === 'lost_focus') {
                    var trailing_start_pos = inp_val.indexOf(' ', caret_pos);
                    if (trailing_start_pos === -1 ) trailing_start_pos = inp_val.length;
                    $inp.val(inp_val.substr(0, caret_pos) + inp_val.substr(trailing_start_pos+1, inp_val.length));
                } else {
                    $inp.val(this.autocomplete_before.value);
                }

                focus_after_close = (reason === 'lost_focus') ?
                    false :
                    true;

                if (focus_after_close) {
                    // Move the cursor position back to where it was
                    $inp.selectRange(caret_pos);
                }

                this.autocomplete.close();
            });

            this.listenTo(this.autocomplete, 'close', function() {
                if (focus_after_close) this.$('.inp').focus();
            });

            this.listenTo(this.autocomplete, 'action-message', function(nick) {
                Application.instance().connections.active_connection.createQuery(nick);
                this.autocomplete.close();
                this.$('.inp').val('');
            });

            this.listenTo(this.autocomplete, 'action-more', function(nick) {
                var active_panel = _kiwi.app.panels().active,
                    members = active_panel.get('members'),
                    member = members.getByNick(nick),
                    userbox,
                    are_we_an_op = !!members.getByNick(_kiwi.app.connections.active_connection.get('nick')).get('is_op');

                userbox = new (require('ui/userbox/userbox'))();
                userbox.setTargets(member, active_panel);
                userbox.displayOpItems(are_we_an_op);

                var menu = new (require('ui/menubox/menubox'))(member.get('nick') || 'User');
                menu.addItem('userbox', userbox.$el);
                menu.showFooter(false);

                _kiwi.global.events.emit('usermenu:created', {menu: menu, userbox: userbox, user: member})
                .then(_.bind(function() {
                    menu.show();

                    var t = _kiwi.app.view.$el.height() - this.autocomplete.$el.outerHeight() - menu.$el.outerHeight();
                    var l = _kiwi.app.view.$el.width() - menu.$el.outerWidth();

                    // Set the new positon
                    menu.$el.offset({
                        left: l,
                        top: t
                    });

                }, this))
                .then(null, _.bind(function() {
                    userbox = null;

                    menu.dispose();
                    menu = null;
                }, this));
            });
        },

        // Taking a matched word form the auto completion, fill it into the current
        // selected word (where the cursor position is)
        autoCompleteFillWord: function(word, place_cursor_after_word) {
            var $inp = this.$('.inp'),
                inp_val = $inp.val(),
                caret_pos = $inp[0].selectionStart;

            // If we have the trailing ': ' after nicks, we need to check further back to find
            // the start of the current word
            var trailing_found = inp_val.substr(caret_pos-2, 2) === ': ';

            var word_start_pos = inp_val.lastIndexOf(' ', caret_pos - (trailing_found ? 2 : 1));
            word_start_pos = (word_start_pos === -1) ? 0 : word_start_pos + 1; // If no space found, start from 0. Otherwise, add 1 to include the space
            var word_end_pos = inp_val.indexOf(' ', word_start_pos);
            if (word_end_pos === -1) word_end_pos = inp_val.length;

            var start_of_inp = inp_val.substr(0, word_start_pos); // Get text before current selected word
            var rest_of_inp = inp_val.substr(word_end_pos); // Get text after current selected word
            var new_val = start_of_inp + word + rest_of_inp; // Join strings before word, the new word, and after word

            $inp.val(new_val);

            // Set the cursor to the same posiiton of the current word as was previous
            var new_position = word_start_pos + this.autocomplete.matching_against_word.length;
            if (place_cursor_after_word) {
                new_position = word_start_pos + word.length;
            }

            // Move the cursor position to the new position
            if ($inp[0].setSelectionRange) {
                $inp[0].setSelectionRange(new_position, new_position);
            } else if ($inp[0].createTextRange) { // IE8 support
                range = $inp[0].createTextRange();
                range.collapse(true);
                range.moveEnd('character', new_position);
                range.moveStart('character', new_position);
                range.select();
            }
        },

        showNickChange: function (ev) {
            // Nick box already open? Don't do it again
            if (this.nick_change)
                return;

            this.nick_change = new (require('ui/nickchange/nickchange'))();
            this.nick_change.render();

            this.listenTo(this.nick_change, 'close', function() {
                delete this.nick_change;
            });
        },

        inputKeyUp: function (ev) {
            // If we're filtering the auto complete list, update the UI with our updated word
            if (this.autocomplete.open && this.autocomplete.filter_list) {
                var $inp = $(ev.currentTarget);
                var tokens = $inp.val().trim().substring(0, $inp[0].selectionStart).split(' ');
                this.autocomplete.update(tokens[tokens.length - 1]);
            }
        },

        inputKeyDown: function (ev) {
            var that = this,
                inp = $(ev.currentTarget),
                inp_val = inp.val(),
                meta;

            if (navigator.appVersion.indexOf("Mac") !== -1) {
                meta = ev.metaKey;
            } else {
                meta = ev.altKey;
            }

            if (this.autocomplete.open) {
                // A return value of true = dont process any other keys
                if (this.autocomplete.onKeyDown(ev)) {
                    return;
                }
            }

            switch (true) {
            case (ev.keyCode === 13):              // return
                inp_val = inp_val.trim();

                if (inp_val) {
                    $.each(inp_val.split('\n'), function (idx, line) {
                        that.processInput(line);
                    });

                    this.buffer.push(inp_val);
                    this.buffer_pos = this.buffer.length;
                }

                inp.val('');

                // The auto complete may not have thrown a match if it was empty, so
                // just make sure it's closed
                if (this.autocomplete.open) {
                    this.autocomplete.close();
                }

                return false;

                break;

            case (ev.keyCode === 38):              // up
                if (this.buffer_pos > 0) {
                    this.buffer_pos--;
                    inp.val(this.buffer[this.buffer_pos]);
                }
                //suppress browsers default behavior as it would set the cursor at the beginning
                return false;

            case (ev.keyCode === 40):              // down
                if (this.buffer_pos < this.buffer.length) {
                    this.buffer_pos++;
                    inp.val(this.buffer[this.buffer_pos]);
                }
                break;

            case (ev.keyCode === 219 && meta):            // [ + meta
                // Find all the tab elements and get the index of the active tab
                var $tabs = $('#kiwi .tabs').find('li[class!=connection]');
                var cur_tab_ind = (function() {
                    for (var idx=0; idx<$tabs.length; idx++){
                        if ($($tabs[idx]).hasClass('active'))
                            return idx;
                    }
                })();

                // Work out the previous tab along. Wrap around if needed
                if (cur_tab_ind === 0) {
                    $prev_tab = $($tabs[$tabs.length - 1]);
                } else {
                    $prev_tab = $($tabs[cur_tab_ind - 1]);
                }

                $prev_tab.click();
                return false;

            case (ev.keyCode === 221 && meta):            // ] + meta
                // Find all the tab elements and get the index of the active tab
                var $tabs = $('#kiwi .tabs').find('li[class!=connection]');
                var cur_tab_ind = (function() {
                    for (var idx=0; idx<$tabs.length; idx++){
                        if ($($tabs[idx]).hasClass('active'))
                            return idx;
                    }
                })();

                // Work out the next tab along. Wrap around if needed
                if (cur_tab_ind === $tabs.length - 1) {
                    $next_tab = $($tabs[0]);
                } else {
                    $next_tab = $($tabs[cur_tab_ind + 1]);
                }

                $next_tab.click();
                return false;

            case (ev.keyCode === 9     //Check if ONLY tab is pressed
                && !ev.shiftKey        //(user could be using some browser
                && !ev.altKey          //keyboard shortcut)
                && !ev.metaKey
                && !ev.ctrlKey):

                ev.preventDefault();

                // Get possible autocompletions
                var autocomplete_list = [],
                    members = Application.instance().panels().active.get('members');

                if (members) {
                    members.forEach(function (member) {
                        if (!member) return;
                        autocomplete_list.push({match: [member.get('nick')], type: 'nick'});
                    });
                }

                // Add this channels name into the auto complete list
                autocomplete_list.push(Application.instance().panels().active.get('name'));

                // Sort what we have alphabetically
                autocomplete_list = _.sortBy(autocomplete_list, function (entry) {
                    // Nicks have a .type property of 'nick'
                    return entry.type === 'nick' ?
                        entry.match[0].toLowerCase() :
                        entry.toLowerCase();
                });

                this.showAutocomplete(autocomplete_list, 'nicks');

                break;

            case (ev.keyCode === 191 && inp_val === ''):    // Forward slash in an empty box
                this.showAutocomplete(this.autocomplete_command_list, 'command', true);
                break;
            }
        },


        setAutoCompleteCommands: function(commands) {
            _.each(commands, function(command) {
                this.autocomplete_command_list.push({
                    match: command.matches || [],
                    description: command.description
                });
            }, this);

            /*
            var command_list = [
                {match: ['/join'], description: 'Join or start a channel'},
                {match: ['/part', '/leave'], description: 'Leave the channel'},
                {match: ['/me', '/action'], description: 'Do something physical'},
                {match: ['/nick'], description: 'Change your nickname'},
                {match: ['/topic'], description: 'Set the topic for the channel'},
            ];
            */
        },


        inputBlur: function(event) {
            // IE hack. Mouse down on auto complete UI sets cancel_blur so we don't loose
            // focus here.
            if (this.autocomplete.cancel_blur) {
                delete this.autocomplete.cancel_blur;
                return;
            }

            this.autocomplete.cancel('lost_focus');
        },


        processInput: function (command_raw) {
            var that = this,
                command, params, events_data,
                pre_processed;

            // If sending a message when not in a channel or query window, automatically
            // convert it into a command
            if (command_raw[0] !== '/' && !Application.instance().panels().active.isChannel() && !Application.instance().panels().active.isQuery()) {
                command_raw = '/' + command_raw;
            }

            // The default command
            if (command_raw[0] !== '/' || command_raw.substr(0, 2) === '//') {
                // Remove any slash escaping at the start (ie. //)
                command_raw = command_raw.replace(/^\/\//, '/');

                // Prepend the default command
                command_raw = '/msg ' + Application.instance().panels().active.get('name') + ' ' + command_raw;
            }

            // Process the raw command for any aliases
            this.preprocessor.vars.server = Application.instance().connections.active_connection.get('name');
            this.preprocessor.vars.channel = Application.instance().panels().active.get('name');
            this.preprocessor.vars.destination = this.preprocessor.vars.channel;
            command_raw = this.preprocessor.process(command_raw);

            // Extract the command and parameters
            params = command_raw.split(/\s/);
            if (params[0][0] === '/') {
                command = params[0].substr(1).toLowerCase();
                params = params.splice(1, params.length - 1);
            } else {
                // Default command
                command = 'msg';
                params.unshift(Application.instance().panels().active.get('name'));
            }

            // Emit a plugin event for any modifications
            events_data = {command: command, params: params};

            _kiwi.global.events.emit('command', events_data)
            .then(function() {
                // Trigger the command events
                that.trigger('command', {command: events_data.command, params: events_data.params});
                that.trigger('command:' + events_data.command, {command: events_data.command, params: events_data.params});

                // If we didn't have any listeners for this event, fire a special case
                // TODO: This feels dirty. Should this really be done..?
                if (!that._events['command:' + events_data.command]) {
                    that.trigger('unknown_command', {command: events_data.command, params: events_data.params});
                }
            });
        },


        showAutocomplete: function(list, type, filter_list) {
            var $inp = this.$('.inp'),
                tokens = $inp.val().trim().substring(0, $inp[0].selectionStart).split(' ');

            this.autocomplete_token_idx = tokens.length - 1;
            this.autocomplete_before = {
                value: $inp.val(),
                caret_pos: $inp[0].selectionStart
            };

            this.autocomplete.showUi(!!_kiwi.global.settings.get('show_autocomplete_slideout'));
            this.autocomplete.setTitle(type);
            this.autocomplete.setWords(list, filter_list);
            this.autocomplete.update(tokens[tokens.length - 1]);
            this.autocomplete.show();
        },


        addPluginIcon: function ($icon) {
            var $tool = $('<div class="tool"></div>').append($icon);
            this.$el.find('.input-tools').append($tool);
            Application.instance().view.doLayout();
        }
    });
});

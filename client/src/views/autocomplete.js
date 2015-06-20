define('views/autocomplete', function(require, exports, module) {

    var Application = require('models/application');

    module.exports = Backbone.View.extend({
        events: {
            'click .autocomplete-item': 'onItemClick',
            'mousemove .autocomplete-item': 'onItemMouseMove',
            'mousedown' : 'onMouseDown',
            'click .autocomplete-item .action': 'onActionClick'
        },

        initialize: function() {
            this.$list = $('<ul class="autocomplete-list"></ul>');
            this.$list.appendTo(this.$el);

            this.reset();
            this.open = false;
            this._show_ui = true;
            this.filter_list = false;
        },

        render: function() {
            return this;
        },


        showUi: function(show_ui) {
            this._show_ui = show_ui;
        },


        // Set the list of words to be searching through
        setWords: function(word_list, filter_list) {
            var new_list = [];
            var template_str_default = '<li class="autocomplete-item"><span class="word"><%= word %></span><span class="matches"><%= match_list %></span><span class="description"><%= description %></span></li>';
            var template_str_nicks = '<li class="autocomplete-item autocomplete-nick" data-nick="<%= word %>"><span class="word"><%= match_list %></span><span class="actions"><a class="action" data-event="message">Message</a><a class="action" data-event="more">More...</a></span></li>';
            var template = {};

            this.reset();

            this.filter_list = !!filter_list;

            _.each(word_list, function(word) {
                var template_str, $el, $word;

                if (this._show_ui) {
                    if (typeof word === 'string') {
                        template.match_list = '';
                        template.word = word;
                        template.description = '';
                    } else {
                        template.match_list = template.word = word.match.join(', ');
                        template.description = word.description || '';
                    }

                    template_str = (word.type === 'nick') ? template_str_nicks : template_str_default;
                    $el = $(_.template(template_str, template)).hide();
                    $word = $el.find('.word');
                } else {
                    template_str = '';
                    $el = null;
                    $word = null;
                }

                var list_entry = {
                    match: (typeof word === 'string') ? [word] : word.match,
                    type: (word.type === 'nick') ? 'nick' : 'default',
                    $el: $el,
                    $word: $word
                };

                new_list.push(list_entry);
                $el && $el.data('word', list_entry);
                $el && $el.appendTo(this.$list);
            }, this);

            this.list = new_list;
        },


        // Update the list with a word to search for
        update: function(word) {
            var first_match = null;

            // No need to update the list if it's the same search
            if (this.matching_against_word !== null && word.toLowerCase() === this.matching_against_word.toLowerCase()) {
                return false;
            }

            // Filter our available auto complete list down to ones that match
            this.matches = _.filter(this.list, function(item) {
                var matched_word = _.find(item.match, function(match_word) {
                    if (match_word.toLowerCase().indexOf(word.toLowerCase()) === 0) {
                        return match_word;
                    }
                });

                if (matched_word) {
                    item.matched_word = matched_word;

                    if (this._show_ui) {
                        item.$word.text(matched_word);
                        item.$el.show();
                    }

                    if (!first_match) {
                        first_match = item;
                    }

                } else {
                    item.matched_word = null;
                    if (this._show_ui) {
                        item.$el.hide();
                    }
                }

                return matched_word;
            }, this);

            this.matching_against_word = word;

            this.$('.selected').removeClass('selected');
            // Reset the selected match to the first
            this.selected_idx = 0;

            if (first_match) {
                this.selectEl(this.matches[0].$el);
                this.trigger('selected', first_match.matched_word, first_match);
            } else {
                this.trigger('selected', null);
            }
        },


        show: function() {
            this.open = true;
            if (this._show_ui) {
                this.$el.css('max-height', (Application.instance().view.$el.height() / 2) + 'px').show();
            }
        },


        close: function() {
            this.open = false;
            this._show_ui && this.$el.hide();
            this.reset();
            this.trigger('close');
        },


        reset: function() {
            this.matching_against_word = null;
            this._show_ui && this.$list.empty();
            this.list = [];
            this.matches = [];
            this.selected_idx = 0;
        },


        onMouseDown: function(event) {
            // This stops the control input box from loosing focus when clicking here
            event.preventDefault();

            // IE doesn't prevent moving focus even with event.preventDefault()
            // so we set a flag to know when we should ignore the blur event
            this.cancel_blur = true;
            _.defer(_.bind(function() {
                delete this.cancel_blur;
            }, this));
        },


        onItemClick: function(event) {
            var el_data = $(event.currentTarget).data('word');
            if (!el_data) return;
            this.trigger('match', el_data.matched_word, el_data);
        },


        onItemMouseMove: function(event) {
            $this = $(event.currentTarget);

            // No need to re-add the class if it already has it
            if ($this.hasClass('selected')) {
                return;
            }

            var idx = null;
            _.each(this.matches, function(match, match_idx) {
                if (match.$el[0] === $this[0]) {
                    idx = match_idx;
                    return false;
                }
            });

            if (idx !== null) {
                this.selected_idx = idx;
                this.selectEl($this);
            }
        },


        onActionClick: function(event) {
            event.stopPropagation();

            var $this = $(event.currentTarget),
                event_name = $this.data('event'),
                $item = $this.parents('.autocomplete-item'),
                el_data = $item.data('word');

            this.trigger('action-'+event_name, el_data.matched_word, el_data);
        },


        previous: function() {
            this.selected_idx = this.matches[this.selected_idx-1] ? this.selected_idx-1 : this.matches.length-1;

            if (this.matches[this.selected_idx]) {
                this.selectEl(this.matches[this.selected_idx].$el, true);
                this.trigger('selected', this.matches[this.selected_idx].matched_word, this.matches[this.selected_idx]);
            }
        },


        next: function() {
            this.selected_idx = this.matches[this.selected_idx+1] ? this.selected_idx+1 : 0;

            if (this.matches[this.selected_idx]) {
                this.selectEl(this.matches[this.selected_idx].$el, true);
                this.trigger('selected', this.matches[this.selected_idx].matched_word, this.matches[this.selected_idx]);
            }
        },


        cancel: function(reason) {
            this.trigger('cancel', reason);
        },


        selectEl: function($el, scroll_in_view) {
            var el, this_height;

            if (!this._show_ui) return;

            this.$('.selected').removeClass('selected');
            if ($el) {
                $el.addClass('selected');
            }

            if ($el && scroll_in_view) {
                el = this.$el[0];
                this_height = this.$el.height();

                $el[0].scrollIntoView();

                if($el.position().top + $el.outerHeight() > this_height / 2){
                    el.scrollTop = el.scrollHeight;
                } else {
                    el.scrollTop -= (this_height / 2);
                }
            }
        },


        currentMatch: function() {
            return this.matches[this.selected_idx].matched_word;
        },


        onKeyDown: function(event) {
            if (!this.open) return;

            var $inp = $(event.currentTarget);
            var dont_process_other_input_keys = false;

            // Handling input box caret positioning
            var caret_pos = 0,
                new_position = 0,
                text_range;

            if (event.keyCode === 38 || (event.keyCode === 9 && event.shiftKey)) { // up or tab+shift
                this.previous();
                event.preventDefault();
                dont_process_other_input_keys = true;
            }
            else if (event.keyCode === 40 || event.keyCode === 9) { // down or tab
                this.next();
                event.preventDefault();
                dont_process_other_input_keys = true;
            }
            else if (0 && event.keyCode === 37) { // left
                // If the caret is moved before the current word, stop autocompleting
                caret_pos = $inp[0].selectionStart;
                if (caret_pos > 0 && $inp.val().toUpperCase()[caret_pos-1] === ' ') {
                    event.preventDefault();
                    this.cancel('caret_moved');
                }
            }
            else if (event.keyCode === 13) { // return
                this.trigger('match', this.currentMatch(), this.matches[this.selected_idx]);
                event.preventDefault();
                dont_process_other_input_keys = true;
            }
            else if (event.keyCode === 27) { // escape
                this.cancel();
            }
            else if (event.keyCode === 32) { // space
                this.cancel('typing');
            }
            else if (event.keyCode === 16) { // shift
                // Shift is used to tab+shift
                dont_process_other_input_keys = true;
            }
            else if (!this.filter_list) {
                // If we have started typing again, cancel the autocomplete
                this.cancel('typing');
            }

            return dont_process_other_input_keys;
        }
    });
});
define('ui/panels/panel_view', function(require, exports, module) {

    var Application = require('ui/application/application');

    module.exports = Backbone.View.extend({
        tagName: "div",
        className: "panel",

        events: {
        },

        initialize: function (options) {
            this.initializePanel(options);
        },

        initializePanel: function (options) {
            this.$el.css('display', 'none');
            options = options || {};

            // Containing element for this panel
            if (options.container) {
                this.$container = $(options.container);
            } else {
                this.$container = $('#kiwi .panels .container1');
            }

            this.$el.appendTo(this.$container);

            this.alert_level = 0;

            this.model.set({"view": this}, {"silent": true});

            this.listenTo(this.model, 'change:activity_counter', function(model, new_count) {
                var $act = this.model.tab.find('.activity');

                if (new_count > 999) {
                    $act.text('999+');
                } else {
                    $act.text(new_count);
                }

                if (new_count === 0) {
                    $act.addClass('zero');
                } else {
                    $act.removeClass('zero');
                }
            });
        },

        render: function () {
        },


        show: function () {
            var $this = this.$el;

            // Hide all other panels and show this one
            this.$container.children('.panel').css('display', 'none');
            $this.css('display', 'block');

            // Show this panels memberlist
            var members = this.model.get("members");
            if (members) {
                Application.instance().rightbar.show();
                members.view.show();
            } else {
                Application.instance().rightbar.hide();
            }

            // Remove any alerts and activity counters for this panel
            this.alert('none');
            this.model.set('activity_counter', 0);

            Application.instance().panels.trigger('active', this.model, Application.instance().panels().active);
            this.model.trigger('active', this.model);

            Application.instance().view.doLayout();
        },


        alert: function (level) {
            // No need to highlight if this si the active panel
            if (this.model == Application.instance().panels().active) return;

            var types, type_idx;
            types = ['none', 'action', 'activity', 'highlight'];

            // Default alert level
            level = level || 'none';

            // If this alert level does not exist, assume clearing current level
            type_idx = _.indexOf(types, level);
            if (!type_idx) {
                level = 'none';
                type_idx = 0;
            }

            // Only 'upgrade' the alert. Never down (unless clearing)
            if (type_idx !== 0 && type_idx <= this.alert_level) {
                return;
            }

            // Clear any existing levels
            this.model.tab.removeClass(function (i, css) {
                return (css.match(/\balert_\S+/g) || []).join(' ');
            });

            // Add the new level if there is one
            if (level !== 'none') {
                this.model.tab.addClass('alert-' + level);
            }

            this.alert_level = type_idx;
        }
    });
});
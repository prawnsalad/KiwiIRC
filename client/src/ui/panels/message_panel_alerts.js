define('ui/panels/message_panel_alerts', function(require, exports, module) {

    var Application = require('ui/application/');
    var utils = require('helpers/utils');

    module.exports = function messagePanelAlerts(panel, message) {
        var msg = message.view.display;

        // Activity/alerts based on the type of new message. We only do this if we have
        // an associated network (think: could be a broadcasted channel so alerts are not needed)
        if (panel.get('network')) {
            if (msg.type.match(/^action /)) {
                panel.view.alert('action');

            } else if (msg.is_highlight) {
                Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));
                Application.instance().view.favicon.newHighlight();
                Application.instance().view.playSound('highlight');
                Application.instance().view.showNotification(panel.get('name'), msg.unparsed_msg);
                panel.view.alert('highlight');

            } else {
                // If this is the active panel, send an alert out
                if (panel.isActive()) {
                    Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));
                }
                panel.view.alert('activity');
            }

            if (panel.isQuery() && !panel.isActive()) {
                Application.instance().view.alertWindow('* ' + utils.translateText('client_views_panel_activity'));

                // Highlights have already been dealt with above
                if (!msg.is_highlight) {
                    Application.instance().view.favicon.newHighlight();
                }

                Application.instance().view.showNotification(panel.get('name'), msg.unparsed_msg);
                Application.instance().view.playSound('highlight');
            }

            // Update the activity counters
            (function () {
                // Only inrement the counters if we're not the active panel
                if (panel.isActive()) return;

                var count_all_activity = _kiwi.global.settings.get('count_all_activity'),
                    exclude_message_types, new_count;

                // Set the default config value
                if (typeof count_all_activity === 'undefined') {
                    count_all_activity = false;
                }

                // Do not increment the counter for these message types
                exclude_message_types = [
                    'action join',
                    'action quit',
                    'action part',
                    'action kick',
                    'action nick',
                    'action mode'
                ];

                if (count_all_activity || _.indexOf(exclude_message_types, msg.type) === -1) {
                    new_count = panel.get('activity_counter') || 0;
                    new_count++;
                    panel.set('activity_counter', new_count);
                }

            }).apply(this);
        }
    };
});
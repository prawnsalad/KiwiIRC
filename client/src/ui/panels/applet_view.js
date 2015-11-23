define('ui/panels/applet_view', function(require, exports, module) {
    module.exports = require('./panel_view').extend({
        className: 'panel applet',
        initialize: function (options) {
            this.initializePanel(options);
        }
    });
});
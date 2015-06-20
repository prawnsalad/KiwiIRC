define('views/applet', function(require, exports, module) {
    module.exports = require('views/panel').extend({
        className: 'panel applet',
        initialize: function (options) {
            this.initializePanel(options);
        }
    });
});
define(function (require, exports, module) {

var PanelView = require('../views/panel');

module.exports = PanelView.extend({
    className: 'panel applet',
    initialize: function (options) {
        this.initializePanel(options);
    }
});
});
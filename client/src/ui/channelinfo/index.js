define('ui/channelinfo/', function(require, exports, module) {
	module.exports = Backbone.Model.extend({
	    initialize: function () {
	        this.view = new (require('./view'))({"model": this});
	    }
	});
});
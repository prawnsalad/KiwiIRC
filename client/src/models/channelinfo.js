_melon.model.ChannelInfo = Backbone.Model.extend({
    initialize: function () {
        this.view = new _melon.view.ChannelInfo({"model": this});
    }
});
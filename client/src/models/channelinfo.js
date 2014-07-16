_kiwi.model.ChannelInfo = Backbone.Model.extend({
    initialize: function () {
        this.view = new _kiwi.view.ChannelInfo({"model": this});
    }
});
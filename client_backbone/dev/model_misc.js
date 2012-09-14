kiwi.model.Misc = kiwi.model.Panel.extend({
    // Used to determine if this is a misc panel. Misc panel tabs are treated
    // differently than others
    misc: true,

    initialize: function (attributes) {
        // Temporary name
        var name = "misc_"+(new Date().getTime().toString()) + Math.ceil(Math.random()*100).toString();
        this.view = new kiwi.view.Misc({model: this, name: name});

        this.set({
            "name": name
        }, {"silent": true});
    },

    html: function (html) {
        this.view.$el.append(html);
    }
});
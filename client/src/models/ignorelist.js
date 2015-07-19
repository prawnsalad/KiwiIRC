_kiwi.model.IgnoreList = Backbone.Collection.extend({
    initialize: function (network) {
        this.ignore_data = _kiwi.model.DataStore.instance('kiwi.ignore_list')
        this.ignore_data.load();

        this.network_address = network.get('address');
        this.stored_ignore_list = this.ignore_data.get(this.network_address) || [];

        // Load the localStorage ignores to the network
        _.each(this.stored_ignore_list, function(item) {
            var new_ignore_list = network.get('ignore_list'),
                user_mask;

            // Make the regex for the given user mask
            user_mask = toUserMask(item[1], true);
            
            // Set the ignore list
            new_ignore_list.push(user_mask);
            network.set('ignore_list', new_ignore_list);
        });

        // Bind adding and removing ignores to update localStorage
        _kiwi.global.events.on('change:ignore_list_add', _.bind(this.saveAddToIgnore, this));
        _kiwi.global.events.on('change:ignore_list_remove', _.bind(this.saveRemoveIgnore, this));
    },

    saveAddToIgnore: function(event, mask) {
        var now,
            time,
            new_ignore_item;

        now = $.now();
        time = now.toString();

        // Prepare the new ignore list
        new_ignore_item = [time, mask];
        this.stored_ignore_list.push(new_ignore_item);
        
        // Store the new item
        this.ignore_data.set(this.network_address, this.stored_ignore_list);
        this.ignore_data.save();
    },

    saveRemoveIgnore: function(event, mask) {
        var index_to_remove;

        _.each(this.stored_ignore_list, function(item, index) {
            if(item[1] == mask) {
                index_to_remove = index;
            }
        });

        this.stored_ignore_list.splice(index_to_remove, 1);

        // Store the updated list
        this.ignore_data.set(this.network_address, this.stored_ignore_list);
        this.ignore_data.save();
    }
});

define('misc/ignorelist', function(require, exports, module) {

    var utils = require('helpers/utils');

    module.exports = Backbone.Collection.extend({
        initialize: function() {
            this.network_address = '';
            this.ignore_data = require('misc/datastore').instance('kiwi.ignore_list');
            this.ignore_data.load();

            this.on('add', _.bind(this.onAdd, this));
            this.on('add', _.bind(this.saveList, this));
            this.on('remove', _.bind(this.saveList, this));
        },


        onAdd: function(entry) {
            if (!entry.get('mask')) return;

            if (!entry.get('time')) {
                entry.set('time', (new Date()).getTime());
            }

            if (!entry.get('regex')) {
                entry.set('regex', utils.toUserMask(entry.get('mask'), true)[1]);
            }
        },


        loadFromNetwork: function(network) {
            this.network_address = network.get('address').toLowerCase();

            var ignore_list = this.ignore_data.get(this.network_address) || [];

            _.each(ignore_list, function(item, idx) {
                if (!item || !item.mask) return;

                // Make the regex for the given user mask
                item.regex = utils.toUserMask(item.mask, true)[1];
            });

            this.reset(ignore_list);
        },


        saveList: function() {
            var list = [];

            this.forEach(function(entry) {
                var obj = _.clone(entry.attributes);
                delete obj.regex;
                list.push(obj);
            });

            this.ignore_data.set(this.network_address, list);
            this.ignore_data.save();
        },


        addMask: function(mask) {
            return this.add({mask: mask});
        },


        removeMask: function(mask) {
            var entry = this.find(function(entry) {
                return entry.get('mask') == mask;
            });

            if (entry) {
                this.remove(entry);
            }
        }
    });
});
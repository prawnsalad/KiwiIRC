(function () {
    var view = Backbone.View.extend({
        events: {},


        initialize: function (options) {
            this.showConnectionDialog();
        },


        showConnectionDialog: function() {
            var connection_dialog = this.connection_dialog = new (require('ui/newconnection/'))();
            connection_dialog.populateDefaultServerSettings();

            connection_dialog.view.$el.addClass('initial');
            this.$el.append(connection_dialog.view.$el);

            var $info = $($('#tmpl_new_connection_info').html().trim());

            if ($info.html()) {
                connection_dialog.view.infoBoxSet($info);
            } else {
                $info = null;
            }

            this.listenTo(connection_dialog, 'connected', this.newConnectionConnected);

            _.defer(function(){
                if ($info) {
                    connection_dialog.view.infoBoxShow();
                }

                // Only set focus if we're not within an iframe. (firefox auto scrolls to the embedded client on page load - bad)
                if (window == window.top) {
                    connection_dialog.view.$el.find('.nick').select();
                }
            });
        },


        newConnectionConnected: function(network) {
            // Once connected, reset the connection form to be used again in future
            this.connection_dialog.view.reset();
        }
    });



    var applet = Backbone.Model.extend({
        initialize: function () {
            this.view = new view({model: this});
        }
    });


    require('ui/panels/applet').register('kiwi_startup', applet);
})();

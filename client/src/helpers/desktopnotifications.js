_kiwi.utils.notifications = (function () {
    if (!window.Notification) {
        return {
            allowed: _.constant(false),
            requestPermission: _.constant($.Deferred().reject())
        };
    }

    var notifications = {
        /**
         * Check if desktop notifications have been allowed by the user.
         *
         * @returns {?Boolean} `true`  - they have been allowed.
         *                     `false` - they have been blocked.
         *                     `null`  - the user hasn't answered yet.
         */
        allowed: function () {
            return Notification.permission === 'granted' ? true
                 : Notification.permission === 'denied' ? false
                 : null;
        },

        /**
         * Ask the user their permission to display desktop notifications.
         * This will return a promise which will be resolved if the user allows notifications, or rejected if they blocked
         * notifictions or simply closed the dialog. If the user had previously given their preference, the promise will be
         * immediately resolved or rejected with their previous answer.
         *
         * @example
         *   notifications.requestPermission().then(function () { 'allowed' }, function () { 'not allowed' });
         *
         * @returns {Promise}
         */
        requestPermission: function () {
            var deferred = $.Deferred();
            Notification.requestPermission(function (permission) {
                deferred[(permission === 'granted') ? 'resolve' : 'reject']();
            });
            return deferred.promise();
        },

        /**
         * Create a new notification. If the user has not yet given permission to display notifications, they will be asked
         * to confirm first. The notification will show afterwards if they allow it.
         *
         * Notifications implement Backbone.Events (so you can use `on` and `off`). They trigger four different events:
         *   - 'click'
         *   - 'close'
         *   - 'error'
         *   - 'show'
         *
         * @example
         *   notifications
         *     .create('Cool notification', { icon: 'logo.png' })
         *     .on('click', function () {
         *       window.focus();
         *     })
         *     .closeAfter(5000);
         *
         * @param   {String}  title
         * @param   {Object}  options
         * @param   {String=} options.body  A string representing an extra content to display within the notification
         * @param   {String=} options.dir   The direction of the notification; it can be auto, ltr, or rtl
         * @param   {String=} options.lang  Specify the lang used within the notification. This string must be a valid BCP
         *                                  47 language tag.
         * @param   {String=} options.tag   An ID for a given notification that allows to retrieve, replace or remove it if necessary
         * @param   {String=} options.icon  The URL of an image to be used as an icon by the notification
         * @returns {Notifier}
         */
        create: function (title, options) {
            return new Notifier(title, options);
        }
    };

    function Notifier(title, options) {
        createNotification.call(this, title, options);
    }
    _.extend(Notifier.prototype, Backbone.Events, {
        closed: false,
        _closeTimeout: null,

        /**
         * Close the notification after a given number of milliseconds.
         * @param   {Number} timeout
         * @returns {this}
         */
        closeAfter: function (timeout) {
            if (!this.closed) {
                if (this.notification) {
                    this._closeTimeout = this._closeTimeout || setTimeout(_.bind(this.close, this), timeout);
                } else {
                    this.once('show', _.bind(this.closeAfter, this, timeout));
                }
            }
            return this;
        },

        /**
         * Close the notification immediately.
         * @returns {this}
         */
        close: function () {
            if (this.notification && !this.closed) {
                this.notification.close();
                this.closed = true;
            }
            return this;
        }
    });

    function createNotification(title, options) {
        switch (notifications.allowed()) {
            case true:
                this.notification = new Notification(title, options);
                _.each(['click', 'close', 'error', 'show'], function (eventName) {
                    this.notification['on' + eventName] = _.bind(this.trigger, this, eventName);
                }, this);
                break;
            case null:
                notifications.requestPermission().done(_.bind(createNotification, this, title, options));
                break;
        }
    }

    return notifications;
}());

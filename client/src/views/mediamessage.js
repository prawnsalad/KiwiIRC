_kiwi.view.MediaMessage = Backbone.View.extend({
    events: {
        'click .media_close': 'close'
    },

    initialize: function () {
        // Get the URL from the data
        this.url = this.$el.data('url');
    },

    toggle: function () {
        if (!this.$content || !this.$content.is(':visible')) {
            this.open();
        } else {
            this.close();
        }
    },

    // Close the media content and remove it from display
    close: function () {
        var that = this;
        this.$content.slideUp('fast', function () {
            that.$content.remove();
        });
    },

    // Open the media content within its wrapper
    open: function () {
        // Create the content div if we haven't already
        if (!this.$content) {
            this.$content = $('<div class="media_content"><a class="media_close"><i class="fa fa-chevron-up"></i> ' + _kiwi.global.i18n.translate('client_views_mediamessage_close').fetch() + '</a><br /><div class="content"></div></div>');
            this.$content.find('.content').append(this.mediaTypes[this.$el.data('type')].apply(this, []) || _kiwi.global.i18n.translate('client_views_mediamessage_notfound').fetch() + ' :(');
        }

        // Now show the content if not already
        if (!this.$content.is(':visible')) {
            // Hide it first so the slideDown always plays
            this.$content.hide();

            // Add the media content and slide it into view
            this.$el.append(this.$content);
            this.$content.slideDown();
        }
    },



    // Generate the media content for each recognised type
    mediaTypes: {
        twitter: function () {
            var tweet_id = this.$el.data('tweetid');
            var that = this;

            $.getJSON('https://api.twitter.com/1/statuses/oembed.json?id=' + tweet_id + '&callback=?', function (data) {
                that.$content.find('.content').html(data.html);
            });

            return $('<div>' + _kiwi.global.i18n.translate('client_views_mediamessage_load_tweet').fetch() + '...</div>');
        },


        image: function () {
            return $('<a href="' + this.url + '" target="_blank"><img height="100" src="' + this.url + '" /></a>');
        },


        imgur: function () {
            var that = this;

            $.getJSON('https://api.imgur.com/oembed?url=' + this.url, function (data) {
                var url = 'https' + data.url.substr(4);
                var img_html = '<a href="' + url + '" target="_blank"><img height="100" src="' + url + '" /></a>';
                that.$content.find('.content').html(img_html);
            });

            return $('<div>' + _kiwi.global.i18n.translate('client_views_mediamessage_load_image').fetch() + '...</div>');
        },


        reddit: function () {
            var that = this;
            var matches = (/reddit\.com\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-z0-9]+)\/([^\/]+)?/gi).exec(this.url);

            $.getJSON('https://www.' + matches[0] + '.json?jsonp=?', function (data) {
                console.log('Loaded reddit data', data);
                var post = data[0].data.children[0].data;
                var thumb = '';

                // Show a thumbnail if there is one
                if (post.thumbnail) {
                    //post.thumbnail = 'http://www.eurotunnel.com/uploadedImages/commercial/back-steps-icon-arrow.png';
                    var thumbnail = 'https' + post.thumbnail.substr(4);

                    // Hide the thumbnail if an over_18 image
                    if (post.over_18) {
                        thumb = '<span class="thumbnail_nsfw" onclick="$(this).find(\'p\').remove(); $(this).find(\'img\').css(\'visibility\', \'visible\');">';
                        thumb += '<p style="font-size:0.9em;line-height:1.2em;cursor:pointer;">Show<br />NSFW</p>';
                        thumb += '<img src="' + thumbnail + '" class="thumbnail" style="visibility:hidden;" />';
                        thumb += '</span>';
                    } else {
                        thumb = '<img src="' + thumbnail + '" class="thumbnail" />';
                    }
                }

                // Build the template string up
                var tmpl = '<div>' + thumb + '<b><%- title %></b><br />Posted by <%- author %>. &nbsp;&nbsp; ';
                tmpl += '<i class="fa fa-arrow-up"></i> <%- ups %> &nbsp;&nbsp; <i class="fa fa-arrow-down"></i> <%- downs %><br />';
                tmpl += '<%- num_comments %> comments made. <a href="https://www.reddit.com<%- permalink %>">View post</a></div>';

                that.$content.find('.content').html(_.template(tmpl)(post));
            });

            return $('<div>' + _kiwi.global.i18n.translate('client_views_mediamessage_load_reddit').fetch() + '...</div>');
        },


        youtube: function () {
            var ytid = this.$el.data('ytid');
            var that = this;
            var yt_html = '<iframe width="480" height="270" src="https://www.youtube.com/embed/'+ ytid +'?feature=oembed" frameborder="0" allowfullscreen=""></iframe>';
            that.$content.find('.content').html(yt_html);

            return $('');
        },


        gist: function () {
            var that = this,
                matches = (/https?:\/\/gist\.github\.com\/(?:[a-z0-9-]*\/)?([a-z0-9]+)(\#(.+))?$/i).exec(this.url);

            $.getJSON('https://gist.github.com/'+matches[1]+'.json?callback=?' + (matches[2] || ''), function (data) {
                $('body').append('<link rel="stylesheet" href="' + data.stylesheet + '" type="text/css" />');
                that.$content.find('.content').html(data.div);
            });

            return $('<div>' + _kiwi.global.i18n.translate('client_views_mediamessage_load_gist').fetch() + '...</div>');
        },

        spotify: function () {
            var uri = this.$el.data('uri'),
                method = this.$el.data('method'),
                spot, html;

            switch (method) {
                case "track":
                case "album":
                    spot = {
                        url: 'https://embed.spotify.com/?uri=' + uri,
                        width: 300,
                        height: 80
                    };
                    break;
                case "artist":
                    spot = {
                        url: 'https://embed.spotify.com/follow/1/?uri=' + uri +'&size=detail&theme=dark',
                        width: 300,
                        height: 56
                    };
                    break;
            }

            html = '<iframe src="' + spot.url + '" width="' + spot.width + '" height="' + spot.height + '" frameborder="0" allowtransparency="true"></iframe>';

            return $(html);
        },

        soundcloud: function () {
            var url = this.$el.data('url'),
                $content = $('<div></div>').text(_kiwi.global.i18n.translate('client_models_applet_loading').fetch());

            $.getJSON('https://soundcloud.com/oembed', { url: url })
                .then(function (data) {
                    $content.empty().append(
                        $(data.html).attr('height', data.height - 100)
                    );
                }, function () {
                    $content.text(_kiwi.global.i18n.translate('client_views_mediamessage_notfound').fetch());
                });

            return $content;
        },

        custom: function() {
            var type = this.constructor.types[this.$el.data('index')];

            if (!type)
                return;

            return $(type.buildHtml(this.$el.data('url')));
        }

    }
    }, {

    /**
     * Add a media message type to append HTML after a matching URL
     * match() should return a truthy value if it wants to handle this URL
     * buildHtml() should return the HTML string to be used within the drop down
     */
    addType: function(match, buildHtml) {
        if (typeof match !== 'function' || typeof buildHtml !== 'function')
            return;

        this.types = this.types || [];
        this.types.push({match: match, buildHtml: buildHtml});
    },


    // Build the closed media HTML from a URL
    buildHtml: function (url) {
        var html = '', matches;

        _.each(this.types || [], function(type, type_idx) {
            if (!type.match(url))
                return;

            // Add which media type should handle this media message. Will be read when it's clicked on
            html += '<span class="media" title="Open" data-type="custom" data-index="'+type_idx+'" data-url="' + _.escape(url) + '"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        });

        // Is it an image?
        if (url.match(/(\.jpe?g|\.gif|\.bmp|\.png)\??$/i)) {
            html += '<span class="media image" data-type="image" data-url="' + url + '" title="Open Image"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is this an imgur link not picked up by the images regex?
        matches = (/imgur\.com\/[^/]*(?!=\.[^!.]+($|\?))/ig).exec(url);
        if (matches && !url.match(/(\.jpe?g|\.gif|\.bmp|\.png)\??$/i)) {
            html += '<span class="media imgur" data-type="imgur" data-url="' + url + '" title="Open Image"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is it a tweet?
        matches = (/https?:\/\/twitter.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/ig).exec(url);
        if (matches) {
            html += '<span class="media twitter" data-type="twitter" data-url="' + url + '" data-tweetid="' + matches[2] + '" title="Show tweet information"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is reddit?
        matches = (/reddit\.com\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-z0-9]+)\/([^\/]+)?/gi).exec(url);
        if (matches) {
            html += '<span class="media reddit" data-type="reddit" data-url="' + url + '" title="Reddit thread"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is youtube?
        matches = (/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/gi).exec(url);
        if (matches) {
            html += '<span class="media youtube" data-type="youtube" data-url="' + url + '" data-ytid="' + matches[1] + '" title="YouTube Video"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is a github gist?
        matches = (/https?:\/\/gist\.github\.com\/(?:[a-z0-9-]*\/)?([a-z0-9]+)(\#(.+))?$/i).exec(url);
        if (matches) {
            html += '<span class="media gist" data-type="gist" data-url="' + url + '" data-gist_id="' + matches[1] + '" title="GitHub Gist"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        // Is this a spotify link?
        matches = (/http:\/\/(?:play|open\.)?spotify.com\/(album|track|artist)\/([a-zA-Z0-9]+)\/?/i).exec(url);
        if (matches) {
            // Make it a Spotify URI! (spotify:<type>:<id>)
            var method = matches[1],
                uri = "spotify:" + matches[1] + ":" + matches[2];
            html += '<span class="media spotify" data-type="spotify" data-uri="' + uri + '" data-method="' + method + '" title="Spotify ' + method + '"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        matches = (/(?:m\.)?(soundcloud\.com(?:\/.+))/i).exec(url);
        if (matches) {
            html += '<span class="media soundcloud" data-type="soundcloud" data-url="http://' + matches[1] + '" title="SoundCloud player"><a class="open"><i class="fa fa-chevron-right"></i></a></span>';
        }

        return html;
    }
});

    (function () {
        var view = Backbone.View.extend({
            events: {
                'click .btn_save': 'onSave'
            },

            initialize: function (options) {
                var that = this,
                    text = {
                        save: _kiwi.global.i18n.translate('client_applets_scripteditor_save').fetch()
                    };
                this.$el = $(_.template($('#tmpl_script_editor').html().trim())(text));

                this.model.on('applet_loaded', function () {
                    that.$el.parent().css('height', '100%');
                    $script(_kiwi.app.get('base_path') + '/assets/libs/ace/ace.js', function (){ that.createAce(); });
                });
            },


            createAce: function () {
                var editor_id = 'editor_' + Math.floor(Math.random()*10000000).toString();
                this.editor_id = editor_id;

                this.$el.find('.editor').attr('id', editor_id);

                this.editor = ace.edit(editor_id);
                this.editor.setTheme("ace/theme/monokai");
                this.editor.getSession().setMode("ace/mode/javascript");

                var script_content = _kiwi.global.settings.get('user_script') || '';
                this.editor.setValue(script_content);
            },


            onSave: function (event) {
                var script_content, user_fn;

                // Build the user script up with some pre-defined components
                script_content = 'var network = kiwi.components.Network();\n';
                script_content += 'var input = kiwi.components.ControlInput();\n';
                script_content += 'var events = kiwi.components.Events();\n';
                script_content += this.editor.getValue() + '\n';

                // Add a dispose method to the user script for cleaning up
                script_content += 'this._dispose = function(){ network.off(); input.off(); events.dispose(); if(this.dispose) this.dispose(); }';

                // Try to compile the user script
                try {
                    user_fn = new Function(script_content);

                    // Dispose any existing user script
                    if (_kiwi.user_script && _kiwi.user_script._dispose)
                        _kiwi.user_script._dispose();

                    // Create and run the new user script
                    _kiwi.user_script = new user_fn();

                } catch (err) {
                    this.setStatus(_kiwi.global.i18n.translate('client_applets_scripteditor_error').fetch(err.toString()));
                    return;
                }

                // If we're this far, no errors occured. Save the user script
                _kiwi.global.settings.set('user_script', this.editor.getValue());
                _kiwi.global.settings.save();

                this.setStatus(_kiwi.global.i18n.translate('client_applets_scripteditor_saved').fetch() + ' :)');
            },


            setStatus: function (status_text) {
                var $status = this.$el.find('.toolbar .status');

                status_text = status_text || '';
                $status.slideUp('fast', function() {
                    $status.text(status_text);
                    $status.slideDown();
                });
            }
        });



        var applet = Backbone.Model.extend({
            initialize: function () {
                var that = this;

                this.set('title', _kiwi.global.i18n.translate('client_applets_scripteditor_title').fetch());
                this.view = new view({model: this});

            }
        });


        _kiwi.model.Applet.register('kiwi_script_editor', applet);
        //_kiwi.model.Applet.loadOnce('kiwi_script_editor');
    })();
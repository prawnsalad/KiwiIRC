_kiwi.view.Member = Backbone.View.extend({
    tagName: "li",
    initialize: function (options) {
        this.model.bind('change', this.render, this);
        this.render();
    },
    render: function () {
        var $this = this.$el,
            prefix_css_class = (this.model.get('modes') || []).join(' ');
        
        $this.attr({'class': 'mode ' + prefix_css_class, 'id': this.model.cid});
        $this.html('<a class="nick"><span class="prefix">' + this.model.get("prefix") + '</span>' + this.model.get("nick") + '</a>');
        
        return this;
    },
    enrich: function () {
        var gender = this.model.get('gender'),
            $this = this.$el,
            status = '',
            tooltip_content,
            style;
        
        if(this.model.get('is_ircop')) {
            status = 'ircop';
        } else if (this.model.get('is_away')) {
            status = 'away';
        }
        
        // If we've got some rich info to display
        if(gender) {
            // Style the nick
            style = gender + ' ' + status;
            $this.addClass('rich_userlist ' + style);
            
            // Build the info tooltip content
            tooltip_content = '<div class="tooltipNick">' + this.model.get('nick') + '</div>';
            if (this.model.get('age') !== '') {
                tooltip_content += this.model.get('age') + ' ' + _kiwi.global.i18n.translate('client_views_member_years_old').fetch() + ', ';
            }
            tooltip_content += _kiwi.global.i18n.translate('client_views_member_gender_' + gender).fetch();
            tooltip_content += '<br />';

            if(this.model.get('is_ircop')) {
                tooltip_content += _kiwi.global.i18n.translate('client_views_member_ircop').fetch() + '<br />';
            }
            if (this.model.get('is_away')) {
                tooltip_content += _kiwi.global.i18n.translate('client_views_member_away').fetch() + '<br />';
            }
            
            if (this.model.get('info') !== '') {
                tooltip_content += this.model.get('info');
            }
            
            // Add the tooltip in the dom
            if(tooltip_content !== '') {
                var info_html = '<div class="tooltip">' + tooltip_content + '</div>';
                $this.append(info_html);

                var id = this.model.cid;
                $this.mouseover(function(){
                    $('#' + id).find('.tooltip').css({'top': $('#' + id).offset().top, 'left': $('#' + id).offset().left -221}).show();
                });
                $this.mouseout(function(){
                    $('#' + id).find('.tooltip').css({'top': 'auto', 'left': 'auto'}).hide();
                });
            }
        }
        return this;
    }
});
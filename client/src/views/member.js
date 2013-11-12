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
            tooltipContent,
            status,
            style;
        
        if(this.model.get('is_ircop')) {
            status = 'ircop';
        } else if (this.model.get('is_away')) {
            status = 'away';
        }
        // If we've got some rich info to display
        if(gender != undefined) {
            // Style the nick
            style = gender + ' ' + status;
            $this.addClass('rich_userlist ' + style);
            
            // Build the info tooltip content
            tooltipContent = '<div class="tooltipNick">' + this.model.get('nick') + '</div>';
            if (this.model.get('age') != '') {
                tooltipContent += this.model.get('age') + ' ' + _kiwi.global.i18n.translate('client_views_member_years_old').fetch() + ', ';
            }
            tooltipContent += _kiwi.global.i18n.translate('client_views_member_gender_' + gender).fetch();
            tooltipContent += '<br />';

            if(this.model.get('is_ircop')) {
                tooltipContent += _kiwi.global.i18n.translate('client_views_member_ircop').fetch() + '<br />';
            }
            if (this.model.get('is_away')) {
                tooltipContent += _kiwi.global.i18n.translate('client_views_member_away').fetch() + '<br />';
            }
            
            if (this.model.get('info') != '') {
                tooltipContent += this.model.get('info');
            }
            
            // Add the tooltip in the dom
            if(tooltipContent != '') {
                var infoHtml = '<div class="tooltip">' + tooltipContent + '</div>';
                $this.append(infoHtml);
                
                $this.attr('onmouseover', "var top = $('#"+this.model.cid+"').offset().top; var left = $('#"+this.model.cid+"').offset().left -221; $('#"+this.model.cid+"').find('.tooltip').css({'top': top, 'left': left}).show();");
                $this.attr({'onmouseout': "$('#"+this.model.cid+"').find('.tooltip').css({'top': 'auto', 'left': 'auto'}).hide()"});
            }
        }
        
        return this;
    }
});
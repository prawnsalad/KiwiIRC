/* =============================================================
 * bootstrap-tagautocomplete.js v0.1
 * http://sandglaz.github.com/bootstrap-tagautocomplete
 * =============================================================
 * Copyright 2013 Sandglaz, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */

!function ($) {

  "use strict"; // jshint ;_;


 /* TAGAUTOCOMPLETE PUBLIC CLASS DEFINITION
  * =============================== */

  var Tagautocomplete = function (element, options) {
    $.fn.typeahead.Constructor.call(this, element, options)
    this.after = this.options.after || this.after
    this.show = this.options.show || this.show
  }

  /* NOTE: TAGAUTOCOMPLETE EXTENDS BOOTSTRAP-TYPEAHEAD.js
     ========================================== */

  Tagautocomplete.prototype = $.extend({}, $.fn.typeahead.Constructor.prototype, {

    constructor: Tagautocomplete

  , select: function () {
      var val = this.$menu.find('.active').attr('data-value')

      var offset = this.updater(val).length - this.length_of_query;
      var position = getCaretPosition(this.$element[0]) + offset

      this.node.splitText(this.index_for_split);
      this.node.nextSibling.splitText(this.length_of_query);
      this.node.nextSibling.nodeValue=this.updater(val);

      this.$element.change();

      this.after();

      setCaretPosition(this.$element[0], position)

      return this.hide()
    }

  , after: function () {

  }

  , show: function () {

      var pos = this.$element.offset();
      var height = this.$element[0].offsetHeight;

      this.$menu
        .appendTo('body')
        .show()
        .css({
          position: "absolute",
          top: pos.top + height + "px",
          left: pos.left + "px"
        });

      this.shown = true
      return this
  }

  , extractor: function () {
      var query = this.query;
      var position = getCaretPosition(this.$element[0]);
      query = query.substring(0, position);
      var regex = new RegExp("(^|\\s)([" + this.options.character + "][\\w-]*)$");
      var result = regex.exec(query);
      if(result && result[2])
        return result[2].trim().toLowerCase();
      return '';
    }

  , updater: function(item) {
      return item.replace('@', '')+' ';
  }

  , matcher: function (item) {
      var tquery = this.extractor();
      if(!tquery) return false;

      //setting the values that will be needed by select() here, because mouse clicks can change these values.
      this.length_of_query = tquery.length
      var range = window.getSelection().getRangeAt(0);
      this.index_for_split = range.startOffset - this.length_of_query;
      this.node = range.startContainer

      return ~item.toLowerCase().indexOf(tquery)
    }

  ,  highlighter: function (item) {
      var query = this.extractor().replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
      return item.replace(new RegExp('(' + query + ')', 'ig'), function ($1, match) {
        return '<strong>' + match + '</strong>'
      })
    }

  })


 /* TAGAUTOCOMPLETE PLUGIN DEFINITION
  * ======================= */

  var old = $.fn.tagautocomplete

  $.fn.tagautocomplete = function (option) {
    return this.each(function () {
      var $this = $(this)
        , data = $this.data('tagautocomplete')
        , options = typeof option == 'object' && option
      if (!data) $this.data('tagautocomplete', (data = new Tagautocomplete(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.tagautocomplete.Constructor = Tagautocomplete

  $.fn.tagautocomplete.defaults = $.extend($.fn.typeahead.defaults, {
    character: '@'
  })


 /* TAGAUTOCOMPLETE NO CONFLICT
  * =================== */

  $.fn.tagautocomplete.noConflict = function () {
    $.fn.tagautocomplete = old
    return this
  }

}(window.jQuery);

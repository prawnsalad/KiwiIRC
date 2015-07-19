function I18n(locale) {
    this.update_locale(locale);
}

I18n.prototype.update_locale = function(locale) {
    this.jed = new Jed(locale);
};

I18n.prototype.translate = function(key) {
    return this.jed.translate.call(this.jed, key);
};

I18n.prototype.translateDOM = function(el) {
    var that = this,
        parent,
        nextSibling,
        fragment;

    if (el.parent) {
        parent = el.parent;
        nextSibling = el.nextSibling;
        fragment = parent.removeChild(el);
    } else {
        fragment = el;
    }

    _.each(fragment.querySelectorAll('[data-translate]'), function (insertion_point) {
        insertion_point.textContent = that.translate(insertion_point.getAttribute('data-translate')).fetch();
    });
    _.each(fragment.querySelectorAll('[data-translate-attr]'), function (insertion_point) {
        var attr = insertion_point.getAttribute('data-translate-attr'),
            key = insertion_point.getAttribute('data-translate-attr-key');
        insertion_point.setAttribute(attr, that.translate(key).fetch());
    });

    if (parent) {
        if (nextSibling) {
            el = parent.insertBefore(el, nextSibling);
        } else {
            el = parent.appendChild(el);
        }
    }

    return el;
};
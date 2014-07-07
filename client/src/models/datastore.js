define(function (require, exports, module) {

var DataStore = module.exports = Backbone.Model.extend({
	initialize: function () {
		this._namespace = '';
		this.new_data = {};
	},

	namespace: function (new_namespace) {
		if (new_namespace) this._namespace = new_namespace;
		return this._namespace;
	},

	// Overload the original save() method
	save: function () {
		localStorage.setItem(this._namespace, JSON.stringify(this.attributes));
	},

	// Overload the original load() method
	load: function () {
		if (!localStorage) return;

		var data;

		try {
			data = JSON.parse(localStorage.getItem(this._namespace)) || {};
		} catch (error) {
			data = {};
		}

		this.attributes = data;
	}
},

{
	// Generates a new instance of DataStore with a set namespace
	instance: function (namespace, attributes) {
		var datastore = new DataStore(attributes);
		datastore.namespace(namespace);
		return datastore;
	}
});
});
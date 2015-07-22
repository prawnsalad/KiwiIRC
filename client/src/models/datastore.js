_kiwi.model.DataStore = Backbone.Model.extend({
	initialize: function () {
		this._namespace = '';
		this.new_data = {};
		this.stored_attributes = {};
	},

	namespace: function (new_namespace) {
		if (new_namespace) this._namespace = new_namespace;
		return this._namespace;
	},

	// Overload the original save() method
	save: function () {
		// Save the current data and update the stored_attributes with a copy
		var stringified = JSON.stringify(this.attributes);
		localStorage.setItem(this._namespace, stringified);
		this.stored_attributes = JSON.parse(this.stringified);
	},

	// Save only one attribute to storage
	saveOne: function (key_name) {
		this.stored_attributes[key_name] = this.get(key_name);
		localStorage.setItem(this._namespace, JSON.stringify(this.stored_attributes));
	},

	// Overload the original load() method
	load: function () {
		if (!localStorage) return;

		var raw, data, stored_data;

		try {
			raw = localStorage.getItem(this._namespace);
			data = JSON.parse(raw) || {};
			stored_data = JSON.parse(raw) || {};
		} catch (error) {
			data = {};
			stored_data = {};
		}

		this.attributes = data;
		this.stored_attributes = stored_data;
	}
},

{
	// Generates a new instance of DataStore with a set namespace
	instance: function (namespace, attributes) {
		var datastore = new _kiwi.model.DataStore(attributes);
		datastore.namespace(namespace);
		return datastore;
	}
});
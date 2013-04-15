_kiwi.model.Gist = function(){
	this.initialize = function(attributes){
		this.description = attributes['description'];
		this.id = attributes['id'];
		this.files = attributes['files'];
		this.id = attributes['description'];
	}
}

_kiwi.model.Gist.create = function(username, files){
	var input = {
		description: 'Gist created by ' + username,
		public: true,
		files: files
	}, url = 'https://api.github.com/gists';

	return $.ajax({ url: url, type: 'POST', data: JSON.stringify(input), dataType: 'json', contentType: 'application/json; charset=utf-8' });
}

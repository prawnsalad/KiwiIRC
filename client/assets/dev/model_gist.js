_kiwi.model.Gist = {}
_kiwi.model.Gist.create = function(username, files){
	var input = {
		description: 'Gist created by ' + username,
		public: true,
		files: files
	};
   var url = 'https://api.github.com/gists';

	return $.ajax({ url: url, type: 'POST', data: JSON.stringify(input), dataType: 'json', contentType: 'application/json; charset=utf-8' });
};
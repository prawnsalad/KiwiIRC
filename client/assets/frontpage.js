$(function(){
	$.ajax({
		url: 'https://api.github.com/gists/5409396',
		dataType: 'json', success: function(gist){
			info = JSON.parse(gist['files']['frontpage.json']['content']);
			$('#allpages-title').html(info['title']);
			$('#frontpage-description').html(info['description']);
			$template = $('#tmpl_server_select');
			$template.html(
				$template.
					html().
					replace('<!--frontpage-description-->', info['description'])
			);
			if(info['hideLogin'] === true){
				$('.server_details').hide();
			}
			if(info['redirectUrl']){
				window.location.href = info['redirectUrl'];
			}
			$('body').addClass('ready')
		}
	});
});

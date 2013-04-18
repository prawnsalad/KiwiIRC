$(function(){
	$.ajax({
		url: 'https://api.github.com/gists/5409294',
		dataType: 'json', success: function(gist){
			info = JSON.parse(gist['files']['frontpage.json']['content']);
			$('#allpages-title').html(info['title']);
			$('#frontpage-description').html(info['description']);
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

<?php

	switch(true){
		case stripos($_SERVER['HTTP_USER_AGENT'], 'android') > 0:
			$agent = "android"; $touchscreen = true;
			break;
			
		case stripos($_SERVER['HTTP_USER_AGENT'], 'iphone') > 0:
			$agent = "iphone"; $touchscreen = true;
			break;
			
		case stripos($_SERVER['HTTP_USER_AGENT'], 'ipod') > 0:
			$agent = "ipod"; $touchscreen = true;
			break;
			
		case stripos($_SERVER['HTTP_USER_AGENT'], 'ipad') > 0:
			$agent = "ipad"; $touchscreen = true;
			break;
			
		default:
			$agent = "normal";
			$touchscreen = false;
	}
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<meta name="viewport" content="width=device-width,user-scalable=no" />
<?php } ?>

<title>kiwi</title>
<link rel="stylesheet" type="text/css" href="css/default.css">
<link rel="stylesheet" type="text/css" href="css/ui.css">

<?php if($touchscreen){ ?>
<link rel="stylesheet" type="text/css" href="css/touchscreen_tweaks.css">
<?php } ?>


<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.3/jquery.min.js"></script>
<script type="text/javascript" src="js/jquery.json-2.2.min.js"></script>
<script type="text/javascript" src="js/util.js"></script>
<script type="text/javascript" src="js/gateway.js"></script>
<script type="text/javascript" src="js/front.js"></script>

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<script type="text/javascript" src="js/touchscreen_tweaks.js"></script>
<?php } ?>

<script type="text/javascript">
	var agent = '<?= $agent ?>';
	var touchscreen = <?= ($touchscreen) ? 'true' : 'false' ?>;
	var init_data = {};
	
	$(document).ready(function(){
		if(touchscreen) $('#kiwi').addClass('touchscreen');
		
		//#nick@irc.anonnet.org:6679+/#channel,##channel,&channel
		var chans = document.location.hash.match(/[#&]+[^ ,\007]+/g);
		if(chans != null && chans.length > 0) { init_data.channel = chans.join(','); }
	
		front.init();
	});
</script>

</head>

<body>

<div id="kiwi">
	<div class="box about">
		<h2>kiwi</h2>
		<p>An alternative to downloading an irc client. This web app is the best thing you'll use in the next couple years.</p>
		<button class="about_close">Close</button>
	</div>
	
	<div class="connectwindow">
		<form class="formconnectwindow">
			<label for="nick">Nick</label>
			<input type="text" class="nick" value="<?php if(isset($_GET['nick'])) echo htmlentities($_GET['nick']); ?>" /><br />
			
			<span class="networkselection">
<?php if(isset($_GET['server'])){ ?>
				<input type="hidden" class="network" value="<?php if(isset($_GET['server'])) echo htmlentities($_GET['server']); ?>" />
<?php } else { ?>
				<label for="network">Network</label>
				<select class="network">
					<?php if(1==1){ echo '<option value="irc.anonnet.org">AnonNet</option>'; } ?>
					<option value="irc.freenode.net">Freenode</option>
					<option value="irc.dal.net">DALnet</option>
					
				</select>
<?php } ?>
			</span>
			<button type="submit">Connect</button>
		</form>
	</div>
	
	
	
	<div class="windowlist">
		<div class="poweredby">Powered by kiwi</div>
		<ul></ul>
	</div>
	
	<div class="userlist">
		<ul></ul>
	</div>
	
	<div class="cur_topic"></div>
	
	<div class="control">
		<div class="msginput">
			<div class="nick"><a href="#"></a>:</div>
			<input type="text" name="kiwi_msginput" id="kiwi_msginput" />
		</div>
		<div class="plugins">
			<ul>
				<li><a class="load_plugin_file">Load plugin file</a></li>
				<li><a class="reload_css">Reload CSS</a></li>
			</ul>
		</div>
	</div>
</div>

</body>
</html>
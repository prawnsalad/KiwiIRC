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
	
	define("SERVER_SET", isset($_GET['server']));
	$server = isset($_GET['server']) ? $_GET['server'] : "irc.anonnet.org";
	$nick = isset($_GET['nick']) ? $_GET['nick'] : "";
	// Channel is set via javascript using location.hash

	$node_server = $_SERVER['HTTP_HOST'];
	
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<meta name="viewport" content="width=device-width,user-scalable=no" />
<?php } ?>

<title>Kiwi IRC</title>
<link rel="stylesheet" type="text/css" href="css/default.css">
<link rel="stylesheet" type="text/css" href="css/ui.css">

<?php if($touchscreen){ ?>
<link rel="stylesheet" type="text/css" href="css/touchscreen_tweaks.css">
<?php } ?>

<script src="http://<?php echo $node_server; ?>:7777/socket.io/socket.io.js"></script>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/jquery.json-2.2.min.js"></script>
<script type="text/javascript" src="js/util.js"></script>
<script type="text/javascript" src="js/gateway.js"></script>
<script type="text/javascript" src="js/front.js"></script>

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<script type="text/javascript" src="js/touchscreen_tweaks.js"></script>
<?php } ?>

<script type="text/javascript">
	var agent = '<?php echo $agent; ?>';
	var touchscreen = <?php echo ($touchscreen) ? 'true' : 'false'; ?>;
	var init_data = {};
	var kiwi_server = 'wss://<?php echo $node_server; ?>:7777/';
	
	$(document).ready(function(){
		if(touchscreen) $('#kiwi').addClass('touchscreen');
		
		//#nick@irc.anonnet.org:6679+/#channel,##channel,&channel
		var chans = document.location.hash.match(/[#&]+[^ ,\007]+/g);
		if(chans != null && chans.length > 0) {
			init_data.channel = chans.join(',');
			$('#channel').val(init_data.channel);
		}
		
		front.init();
		gateway.start(kiwi_server);
		
		addEvents();
		$('.nick').focus();
	});
	
	
	function addEvents(){
		$('.more_link').click(function(){ $('.content.bottom').slideDown('fast'); $('.network').focus(); return false; });
		$('.formconnectwindow').submit(function(){
			init_data.channel = $('#channel').val();
			return false;
		});
		$('a.connect').click(function(){ $('.formconnectwindow').submit(); return false; });
	}
</script>

</head>

<body>

<div id="kiwi">
	<div class="connectwindow">
		<h1 class="logo">Kiwi IRC</h1>
		<div id="login">
			<form class="formconnectwindow">
				<div class="content top">
					<ul>
						<li><label for="nick">Your nickname:</label>
							<input type="text" id="nick" name="nick" class="nick" value="<?php echo htmlentities($nick); ?>" /></li>
					</ul>
					<a class="connect" href="">Connect..</a>
				</div>
				
				<div class="more" style="<?php if(SERVER_SET) echo "display:none;"; ?>">
					<a href="" class="more_link">More</a>
					<div class="content bottom">
						<ul>
							<li><label for="network">Server:</label>
								<input type="text" id="network" name="network" class="network" value="<?php echo htmlentities($server); ?>" /></li>
							<li><label for="channel">Channel:</label>
								<input type="text" id="channel" name="channel" class="channel" value="#kiwiirc" /></li>
						</ul>
						<a class="connect" href="">Connect..</a>
					</div>
				</div>
			</form>
		</div>
	</div>
	
	
	
	<div class="windowlist">
		<div class="poweredby">Powered by Kiwi IRC</div>
		<ul></ul>
	</div>
	
	<div class="cur_topic"></div>
	
	<div class="userlist">
		<ul></ul>
	</div>
	
	<div class="control">
		<div class="msginput">
			<div class="nick"><a href="#"></a>:</div>
			<input type="text" name="kiwi_msginput" id="kiwi_msginput" />
		</div>
		<div class="plugins">
			<ul>
				<!-- <li><a class="load_plugin_file">Plugins</a></li> -->
				<?php if(isset($_GET['debug'])){ ?>
				<li><a class="reload_css">Reload CSS</a></li>
				<?php } ?>
			</ul>
		</div>
	</div>
</div>

</body>
</html>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>kiwi</title>
<link rel="stylesheet" type="text/css" href="css/default.css">
<link rel="stylesheet" type="text/css" href="css/ui.css">

<?php

	switch(true){
		case stripos($_SERVER['HTTP_USER_AGENT'], 'android') > 0:
		case stripos($_SERVER['HTTP_USER_AGENT'], 'iphone') > 0:
		case stripos($_SERVER['HTTP_USER_AGENT'], 'ipod') > 0:
?>
<meta name="viewport" content="width=device-width,user-scalable=no" />

<?php
			break;
			
	}
?>

<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.3/jquery.min.js"></script>
<script type="text/javascript" src="js/jquery.json-2.2.min.js"></script>
<script type="text/javascript" src="js/util.js"></script>
<script type="text/javascript" src="js/gateway.js"></script>
<script type="text/javascript" src="js/front.js"></script>
<script type="text/javascript">

	var init_data = {};

	$(document).ready(function(){
		
		//#nick@irc.anonnet.org:6679+/#channel,##channel,&channel
		var chans = document.location.hash.match(/[#&]+[^ ,\007]+/g);
		if(chans != null && chans.length > 0) { init_data.channel = chans.join(','); }
	
		front.init();
	});
</script>

</head>

<body>

<div id="kiwi">
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
					<option value="irc.anonnet.org">AnonNet</option>
					<option value="irc.freenode.net">Freenode</option>
					<option value="irc.dal.net">DALnet</option>
					
				</select>
<?php } ?>
			</span>
			<button type="submit">Connect</button>
		</form>
	</div>
	
	
	
	
		<div class="windowlist">
			<ul></ul>
			<div class="poweredby">Powered by kiwi</div>
		</div>
		
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
                    <li><a class="load_plugin_file">Load plugin file</a></li>
                </ul>
			</div>
		</div>
</div>

</body>
</html>

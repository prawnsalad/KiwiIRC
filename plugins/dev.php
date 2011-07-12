<?php

	require("plugin.php");
	$p = new Plugin();
	$p->name = "Dev Tools";
	
	$p->onload = <<<JS
function(){
	$('#kiwi .plugins ul').append('<li><a id="dev_tools_open">Dev Tools</a></li>');
	$('#dev_tools_open').click(function(){ alert("Opening Dev Tools window"); });
}
JS;

	$p->onunload = <<<JS
function(){ alert('unloading dev tools'); $('#dev_tools_open').remove(); }
JS;

	echo $p->export();
<?php
	
	require("plugin.php");
	$p = new Plugin();
	$p->name = "Console Logger";

	$p->onprivmsg = <<<JS
function(inp, tabview){
	console.log("> "+tabview+": "+inp);
}
JS;

	echo $p->export();
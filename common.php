<?php

	// Class for storing global vars
	class GLOB {
		// Memcache connection
		static $mc;
	}
	
	
	if($config['memcache_use']){
		GLOB::$mc = new Memcache();
		GLOB::$mc->addServer('localhost', 11211, true, 1);
	}
	
	
	
	function deb($what){
		//if(DEBUG){
		//	echo "$what\n";
		//} else {
			file_put_contents('/tmp/kiwi_err.log', "$what\n", FILE_APPEND);
		//}
	}
	function debug($what){ deb($what); }
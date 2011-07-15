<?php
	
	$config = array(
		'sok_dir' => '/tmp/',
		'sok_prefix' => 'kiwi_',
		
		'memcache_use' => true,
		'memcache_addr' => 'localhost',
		'memcache_port' => 11211,
		
		'php_path' => '/usr/bin/php5',
		'session_script_path' => dirname(__FILE__).'/irc_session.php',
		//Unused 'cons_per_host' => 5,
		
		'messages_per_poll' => 30,
		'max_time_per_poll' => 30, //60*2,
		'timeout' => 5, // minimum time in seconds in which the webclient needs to poll the server
		'scrollback_size' => 15,
		'connections_per_host' => 20,
		
		'websocket' => array(
			'bind_addr'=>'0.0.0.0',
			'bind_port'=>7777
		)
	);
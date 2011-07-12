<?php

	/*
	 * CASE: Page requested to start a session.
	 *     1. Attempt connect to the server
	 *          Fail?
	 *            End session and send error to the client
	 *          Connected?
	 *            Create a listening UNIX socket and send OK to the client
	 *
	 *     2. Run the IRC client class as normal, while polling for connections
	 *        on the listening socket. Save any messages for the web client into
	 *        a buffer.
	 *        This is the normal running state.
	 *
	 *     3. Upon a connection on the UNIX socket, send the oldest message from
	 *        the buffer to the web client, FIFO style and close the connection.
	 */
	
	// If -d has been sent to start this session, start in debug mode
	if(in_array('-d', $argv)){
		define('DEBUG', true);
	} else {
		define('DEBUG', false);
	}
	
	
	require(dirname(__FILE__).'/config.php');
	require(dirname(__FILE__).'/common.php');
	require(dirname(__FILE__).'/class_session.php');
	require(dirname(__FILE__).'/class_irc.php');
	require(dirname(__FILE__).'/class_ircconnection.php');
	require(dirname(__FILE__).'/ircd_profiles/hybrid.php');
	
	
	// Make sure a session id has been specified
	if(!isset($argv[1]) || empty($argv[1]))
		die('no_session');
	
	$session_id = $argv[1];
	$host_key = $argv[2];		// The remote host key in memcached
	
	// Process any arguments
	$app_args = array();
	foreach($argv as $a){
		$value = substr($a, 2);
		switch(substr($a, 0, 2)){
			case '-h':
				// Client host
				$app_args['remote_host'] = $value;
				break;
		}
	}
	
	
	// Start the unix session, and if it fails quit here
	$ipc_srv = SESSIONS::clStart($session_id);
	if($ipc_srv === false) die("fail '$session_id' '$host_key'");
	
	// Debug mode runs in terminal to see output
	if(!DEBUG){
		// See if we can fork our process..
		$pid = pcntl_fork();
		if($pid === -1){
			die('Forking error');
		}elseif($pid){
			// Parent process
			die('ok');
		}else{
			// Child process
			fclose(STDOUT);
		}
	}
	
	//posix_setsid();

	
	
	############################################
	## Main process
	############################################
	
	$old_error_handler = set_error_handler("errorHandler");
	
	$bot = null; // The IRC connection
	$ipc = array(); // The IPC connections to the web clients
	$ipc_read = array(); // The IPC connections wanting to read the buffer
	$buffer = array(); // Messages to be sent to the web client
	$send_debug = false;
	
	deb("Starting $session_id");
	
	$timeout = time();
	$timeout_timer = 0;
	while(true){
		// If there are no webclients connected, start the timer to disconnect
		if(!count($ipc)){
			if($timeout == 0) $timeout = time();
			$timeout_timer = time() - $timeout;
			if($timeout_timer >= $config['timeout']) break;
		} else {
			$timeout = 0;
		}
		
		processClients();
	
		if($bot != null){
			// $bot handles the sleep time here
			$bot->Process();
		} else {
			usleep(5000);
		}
	}
	
	
	// We've quit, lower the counter for this host
	if($config['memcache_use']){
		@GLOB::$mc->decrement($host_key);
	}
	
	deb('Exiting client');
	
	
	############################################
	## Functions / Classes
	############################################
	
	
	
	function processClients(){
		global $ipc_srv;
		global $ipc;
		global $ipc_read;
		global $buffer;
		global $timeout;
		
		// Check for any new web client connections...
		$read = array($ipc_srv);
		$write = $excep = array();
		$read_changed = stream_select($read, $write, $excep, 0);
		for($i=0; $i<$read_changed; $i++) {
			if($read[$i] === $ipc_srv){
				$ipc[] = stream_socket_accept($ipc_srv);
				deb("Connection...");
			}
		}
		
		
		// Check for any changed web clients..
		$read = $ipc;
		$read_changed = (count($read)) ? stream_select($read, $write, $excep, 0) : array();
		if($read_changed){
			foreach($read as $cl){
				$data = fread($cl, 1024);
				if(!$data){
					// Web client has disconnected
					deb("Removing closed socket..");
					$key = array_search($cl, $ipc);
					unset($ipc[$key]);
					
					$key = array_search($cl, $ipc_read);
					if($key !== false) unset($ipc_read[$key]);
				} else {
					//deb('Got data: '.$data);
					processClientMessage($data, $cl);
				}
			}
		}
		
		
		
		// Send the buffer messages to any connected web clients..
		// 1 message at a time...
		if(count($buffer) && count($ipc_read)){
			//deb(print_r($ipc_read, 1));
			$msg = array_shift($buffer);
			//deb("Sending '$msg' to ".count($ipc_read)." clients..");
			foreach($ipc_read as $cl){
				if($cl) fwrite($cl, $msg."\n");
			}
		}
		
		// The whole buffer at a time...
		/*
		while(count($buffer)){
			$msg = array_shift($buffer);
			foreach($ipc as $cl) frwite($cl, $msg);
		}
		*/
		
	}
	
	
	function processClientMessage($data, $cl){
		global $config;
		global $buffer;
		global $bot, $ipc_read;
		global $timeout;
		global $send_debug;
		global $app_args;
		
		require('dev_processClientMessage.php');
		return true;
	}
		
	
	
	
	function errorHandler($errno, $errstr, $errfile, $errline){
		$ret = '';
		switch ($errno) {
			case E_USER_ERROR:
				$ret .= "USER [$errno] $errstr\n";
				$ret .= "  Fatal error on line $errline in file $errfile";
				$ret .= ", PHP " . PHP_VERSION . " (" . PHP_OS . ")\n";
				$ret .= "Aborting...<br />\n";
				exit(1);
				break;

			case E_USER_WARNING:
				$ret .= "WARNING on line $errline in file $errfile: [$errno] $errstr\n";
				break;

			case E_USER_NOTICE:
				$ret .= "NOTICE on line $errline in file $errfile: [$errno] $errstr\n";
				break;

			default:
				$ret .= "UNKOWN ERR on line $errline in file $errfile: [$errno] $errstr\n";
				break;
		}
		
		if(!empty($ret)) deb($ret);			
		
		
		/* Don't execute PHP internal error handler */
		return true;
	}
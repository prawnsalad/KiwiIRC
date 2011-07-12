<?php
	
	require(dirname(__FILE__).'/config.php');
	require(dirname(__FILE__).'/common.php');
	require(dirname(__FILE__).'/class_session.php');
	
	$starttime = time();
	
	############################################
	## New sessions
	############################################
	
	// If no session has been specified, start a new one
	if(empty($_POST)){
		$new_session = SESSIONS::create($_SERVER['REMOTE_ADDR']);
		
		// Session creation fail?
		if($new_session === false){
			die(gen_response(array('error'=>'session_error')));
		}
		
		// Session create OK, yay
		die(gen_response(array('session_id'=>$new_session)));
	}
	
	
	
	############################################
	## Existing sessions
	############################################
	
	// Quit here if a session hasn't been specified
	if(!isset($_POST['sid']) || empty($_POST['sid'])){
		die(gen_response(array('error'=>'session_not_set')));
	}
	
	$session_id = $_POST['sid'];
	
	// Make sure the session exists
	if(!SESSIONS::exists($session_id)){
		die(gen_response(array('error'=>'no_session')));
	}
	
	// Connect to the IRC session
	$ses = SESSIONS::open($session_id);
	if(!$ses){
		die(gen_response(array('error'=>'session_error')));
	}
	
	if(!isset($_POST['data'])){
		// Read any commands to be sent to the web client
		$data = array();
		
		/* This was used for blocking the first call which caused a wait of timeout seconds if the user quits
		// Make this read block
		$tmp = json_decode(trim(SESSIONS::read($ses, true)),1);
		if($tmp != null) $data[] = $tmp;
		*/
		
		// Unblocked reads just incase only 1 message is actually available
		$start_time = time();
		while(time() - $start_time < $config['max_time_per_poll'] && count($data) == 0 && !connection_aborted()){
			for($i=0; $i<$config['messages_per_poll']; $i++){
				if(connection_aborted()){
					deb("Connection aborted");
					break;
				}
				deb("Polling..");
				$tmp = json_decode(trim(SESSIONS::read($ses, false)),1);
				if($tmp != null){
					$data[] = $tmp;
				} else {
					break;
				}
				
				echo " ";
				flush();
			}
			
			if(count($data) == 0) sleep(1);
		}
		deb("Polled");
		
		if(!empty($data)){
			echo gen_response($data);
		} else {
			echo gen_response(array());
		}
	} else {
		fwrite($ses, $_POST['data']);
	}
	
	// We're done here, close the session connection
	SESSIONS::close($ses);
	
	
	
	
	
	
	
	
	
	############################################
	## Functions
	############################################
	
	function gen_response($data){
		return json_encode($data);
	}

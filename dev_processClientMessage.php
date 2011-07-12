<?php


		//deb("FROM IPC CLIENT:\n$data\n-----");
		$d = json_decode($data, 1);
		//deb('Processed data: '.print_r($d, 1));
		switch($d['method']){
			case 'addbuffer':
				$buffer[] = json_encode($d['args']);
				break;
				
			case 'read':
				// The 'read' command adds this web client to the read buffer queue
				if(!in_array($cl, $ipc_read)) $ipc_read[] = $cl;
				break;
				
			case 'quit':
				deb('Quitting');
				$bot = null;
				break;
				
			case 'connect':
				$args = $d['args'];
				deb('Connecting with: '.print_r($args, 1));
				if(!isset($args['server'], $args['port'], $args['ssl'], $args['nick'])){
					$buffer[] = json_encode(array('error'=>'invalid_args'));
					break;
				} else {
					$kiwi = null;
					/*if($config['memcache_use']){
						$conf_key = 'kiwi_conf_'.$args['server'];
						$conf = (int)GLOB::$mc->get($conf_key);
						if($conf){
							$c = @unserialize($conf);
							if($c){
								//$hostname = GET HOSTNAME HERE
								//$ip = GET IP HERE
								$kiwi = "WEBIRC {$c['password']} {$c['user']} $hostname $ip";
							}
						}
					}*/
					deb("ARGSLOL: ".print_r($app_args, 1));
					$opts = array();
					if(isset($app_args['remote_host'])) $opts['ident'] = md5($app_args['remote_host']);
					
					$bot = new IRCConnection("irc://{$args['nick']}@{$args['server']}:{$args['port']}", $kiwi, $opts);
					if(isset($args['channels'])) $bot->chans = explode(',', $args['channels']);
					if($bot->connected){
						// We're.. connected!
					} else {
						$buffer[] = json_encode(array('event'=>'server_connect', 'connected'=>false, 'host'=>$args['server']));
						unset($bot);
					}
				}
				break;
				
			case 'join':
				$args = $d['args'];
				if(!isset($args['channel'])){
					$buffer[] = json_encode(array('error'=>'invalid_args'));
					break;
				} else {
					$chans = explode(',', $args['channel']);
					foreach($chans as $c)
						$bot->Join($c);
				}
				break;
				
			case 'msg':
				$args = $d['args'];
				deb('msg with: '.print_r($args, 1));
				if(!isset($args['target'],$args['msg'])){
					$buffer[] = json_encode(array('error'=>'invalid_args'));
					break;
				} else {
					$bot->SendMessage($args['target'], $args['msg']);
					$buffer[] = json_encode($data);
				}
				break;
				
			case 'action':
				$args = $d['args'];
				deb('action with: '.print_r($args, 1));
				if(!isset($args['target'],$args['msg'])){
					$buffer[] = json_encode(array('error'=>'invalid_args'));
					break;
				} else {
					$bot->SendMessage($args['target'], chr(1)."ACTION {$args['msg']}".chr(1));
					$buffer[] = json_encode($data);
				}
				break;
				
			case 'raw':
				$args = $d['args'];
				if(!isset($args['data'])){
					$buffer[] = json_encode(array('error'=>'invalid_args'));
					break;
				} else {
					$bot->stream->Write("{$args['data']}\r\n");
					//$bot->SendMessage($args['target'], $args['msg']);
				}
				break;
				
				
			case 'debug':
				$send_debug = !$send_debug;
				$data = array(
					'event' => 'debug',
					'msg' => 'Debugging '.($send_debug)?'on':'off',
					'time' => time()
				);
				$buffer[] = json_encode($data);
				break;
				
				
			case 'sync':
				// Clear the current buffer as we're gonna send only scrollback
				$buffer = array();
				
				// Send the settings and channels over
				if($bot){
					$data = array('event'=>'sync');
					$data['nick'] = $bot->nick;
					$data['tabviews'] = array();
					if($bot->chanlist){
						foreach($bot->chanlist as $chan_name => $chan){
							$data['tabviews'][] = array('name'=>$chan_name, 'userlist'=>$chan['userlist']);
						}
						$buffer[] = json_encode($data);
					}
					
					// Send the message scrollback
					foreach($bot->scrollback as $line) $buffer[] = json_encode($line);
					//$bot->scrollback = array();
				} else {
					$data = array('error'=>'no_data');
				}
				
				$buffer[] = json_encode($data);
				
				break;
		}
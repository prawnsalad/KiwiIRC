<?php

	class IRCConnection extends IRC {
		
		var $scrollback = array();
		var $server_options = array();
		
		function ProcessMessage($message){
			global $config;
			global $buffer;
			global $send_debug;
			
			//debug("Message: ".print_r($message, 1));
			deb(print_r($message, 1));
			
			if(strlen($message['trailing']) && ord($message['trailing'][0]) == 1){
				$message['trailing'] = trim($message['trailing'], chr(1));
				if(strtoupper(substr($message['trailing'], 1, 6)) == 'ACTION'){
					$message['command'] = 'ACTION';
				} else {
					$message['command'] = 'CTCP';
				}
			}
			
			switch(strtoupper($message['command'])){
				case '001':
					$buffer[] = json_encode(array(
						'event'=>'connect',
						'connected'=>true,
						'host'=>$args['server']
					));
					break;
					
				case '005':
					$opts = explode(' ', $message['params']);
					$to_client = array();
					foreach($opts as $pair){
						$opt = explode('=', $pair, 2);
						$name = strtoupper($opt[0]);
						$val = isset($opt[1]) ? $opt[1] : true;
						$this->server_options[$name] = $val;
						
						if(in_array($name, array('NETWORK', 'PREFIX', 'CHANTYPES'))){
							// Put the user prefixes (~&@ etc etc) into a more usable format
							if($name == 'PREFIX'){
								$matches = null;
								preg_match('/\(([^)]*)\)(.*)/', $val, $matches);
								
								$val = array();
								if(count($matches) == 3){
									for($i=0; $i<strlen($matches[1]); $i++){
										$val[$matches[2][$i]] = $matches[1][$i];
									}
								}
							}
							$to_client[$name] = $val;
						}
					}
					
					$data = array(
						'event' => 'options',
						'server' => '',
						'options' => $to_client
					);
					$buffer[] = json_encode($data);
					break;
					
				case RPL_WHOISUSER:
				case RPL_WHOISSERVER:
				case RPL_WHOISOPERATOR:
				case RPL_WHOISIDLE:
				case RPL_ENDOFWHOIS:
				case RPL_WHOISCHANNELS:
				case RPL_WHOISMODES:
					$tmp = explode(' ', $message['params']);
					$tmp = $tmp[1];
					$data = array(
						'event' => 'whois',
						'server' => '',
						'nick' => $tmp,
						'msg' => $message['trailing']
					);
					$buffer[] = json_encode($data);
					break;
				
				case RPL_MOTD:
					$data = array(
						'event' => 'motd',
						'server' => '',
						'msg' => $message['trailing']
					);
					$buffer[] = json_encode($data);
					break;
					
				case "353":
					// NAMES command reply
					list($nick,,$chan) = explode(" ", $message['params']);
					$nicks = explode(" ", $message['trailing']);
					
					$data = array(
						'event' => 'userlist',
						'server' => '',
						'users' => array(),
						'channel' => $chan
					);
					
					$prefixes = array('~', '&', '@','%','+');
					$nicklist = array();
					$i = 0;
					foreach($nicks as $nick){
						if(in_array($nick{0}, $prefixes)){
							$prefix = $nick{0};
							$nick = substr($nick,1);
						} else {
							$prefix = '';
						}
						$nicklist[$nick] = $prefix;
						
						if($i==50){
							$tmp = $data;
							$tmp['users'] = $nicklist;
							$buffer[] = json_encode($tmp);
							unset($tmp);
							$nicklist = array();
						}
						
						$i++;
					}
					
					if(count($nicklist)){
						$tmp = $data;
						$tmp['users'] = $nicklist;
						$buffer[] = json_encode($tmp);
					}
					//deb(print_r($data, 1));
					break;
					
				case '366':
					list(,$chan) = explode(' ', $message['params']);
					$data = array(
						'event' => 'userlist_end',
						'server' => '',
						'channel' => $chan
					);
					$buffer[] = json_encode($data);
					break;
					
				case ERR_LINKCHANNEL:
					list($nick, $source_chan, $dest_chan) = explode(' ', $message['params']);
					$data = array(
						'event' => 'channel_redirect',
						'from' => $source_chan,
						'to' => $dest_chan
					);
					$buffer[] = json_encode($data);
					break;
					
				case ERR_NOSUCHNICK:
					//TODO: shit
					break;
					
				case "JOIN":
					$data = array(
						'event' => 'join',
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'channel' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					
					deb("JOIN: {$message['nick']} / {$this->nick}");
					if($message['nick'] == $this->nick){
						$this->stream->Write("NAMES {$message['trailing']}\r\n");
					}
					
					break;
					
				case "PART":
					$data = array(
						'event' => 'part',
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'channel' => trim($message['params']),
						'message' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					break;
					
				case "KICK":
					$tmp = explode(' ', $message['params']);
					
					$data = array(
						'event' => 'kick',
						'kicked' => $tmp[1],
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'channel' => trim($tmp[0]),
						'message' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					break;
					
				case "QUIT":
					$data = array(
						'event' => 'quit',
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'message' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					break;
					
				case "NOTICE":
					$data = array(
						'event' => 'notice',
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'msg' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					break;
					
				case "NICK":
					$data = array(
						'event' => 'nick',
						'nick' => $message['nick'],
						'ident' => $message['ident'],
						'hostname' => $message['hostname'],
						'newnick' => $message['trailing'],
					);
					$buffer[] = json_encode($data);
					break;
					
				case 'TOPIC':
					$data = array(
						'event' => 'topic',
						'nick' => $message['nick'],
						'channel' => $message['params'],
						'topic' => $message['trailing']
					);
					$buffer[] = json_encode($data);
					break;
					
				case '332':
					$tmp = explode(' ', $message['params']);
					$data = array(
						'event' => 'topic',
						'nick' => '',
						'channel' => $tmp[1],
						'topic' => $message['trailing']
					);
					$buffer[] = json_encode($data);
					break;
					
				case 'ACTION':
					$data = array(
						'event' => 'action',
						'nick' => $message['nick'],
						'msg' => trim(substr($message['trailing'], 8), chr(1)),
						'channel' => $message['params'],
						'time' => time()
					);
					$buffer[] = json_encode($data);
					break;
					
				case 'CTCP':
					$data = array(
						'event' => 'ctcp',
						'nick' => $message['nick'],
						'msg' => trim(substr($message['trailing'], 8), chr(1)),
						'channel' => $message['params'],
						'time' => time()
					);
					$buffer[] = json_encode($data);
					break;
					
				case 'MODE':
					$opts = explode(' ', $message['params']);
					if(count($opts) == 1){
						$effected_nick = $opts[0];
						$mode = $message['trailing'];
					} elseif(count($opts) == 2){
						$channel = $opts[0];
						$mode = $opts[1];
					} else {
						$channel = $opts[0];
						$mode = $opts[1];
						$effected_nick = $opts[2];
					}
					
					$data = array(
						'event' => 'mode',
						'nick' => $message['nick'],
						'mode' => $mode
					);
					
					if(isset($effected_nick)) $data['effected_nick'] = $effected_nick;
					if(isset($channel)) $data['channel'] = $channel;
					$buffer[] = json_encode($data);
					
					break;
			}
			
			if($send_debug){
				$ret = str_replace('\n', ' ', print_r($message, 1));
				$data = array(
					'event' => 'debug',
					'msg' => $ret,
					'time' => time()
				);
				$buffer[] = json_encode($data);
			}
			
			parent::ProcessMessage($message);
		}
		
		
		
		
		function ProcessPrivMsg($message){
			global $buffer;
			global $timeout;
			global $config;
			
			$msg = $message['trailing'];
			$cmd = strtok($msg, ' ');
			//debug(print_r($message));
			//deb(print_r($message, 1));
			$data = array(
				'event' => 'msg',
				'nick' => $message['nick'],
				'msg' => $message['trailing'],
				'channel' => $message['params'],
				'time' => time()
			);
			
			// Save it into the scrollback
			if($config['scrollback_size']){
				deb('Size: '.count($this->scrollback));
				if(count($this->scrollback) >= $config['scrollback_size']){
					
					for($i=1; $i<count($this->scrollback); $i++){
						$this->scrollback[$i-1] = $this->scrollback[$i];
					}
					/*
					for($j=$i; $j<count($this->scrollback); $j++){
						unset($this->scrollback[$i]);
					}
					//unset($this->scrollback[$i]);
					*/
					$pos = count($this->scrollback)-1;
					deb('Popped');
				} else {
					$pos = count($this->scrollback);
				}
				
				$this->scrollback[$pos] = $data;
			}
			
			$buffer[] = json_encode($data);
			parent::ProcessPrivMsg($message);
			
			return;
		}
		
		
		private function isChannel($name){
			return ($name[0] == "#");
		}
		
		
		private function formatMsgToHtml($inp){
			$tmp = $inp;
			
			// Bold
			if(strpos($tmp, chr(2))){
				$next = '<b>';
				while(strpos($tmp, chr(2)) !== false){
					$pos = strpos($tmp, chr(2));
					$tmp = str_replace($tmp, chr(2), $next);
					$next = ($next=='<b>') ? '</b>' : '<b>';
				}
				if($next == '</b>') $tmp = $tmp . '</b>';
			}
			
			return $tmp;
		}
		
	}
<?php

	class SESSIONS {
		static function exists($session_id){
			global $config;
			
			if($config['memcache_use']){
				$ret = GLOB::$mc->get('sid_'.$session_id) ? true : false;
				return $ret;
			} else {
				$session_sok = $config['sok_dir'].$config['sok_prefix'].$session_id;
				return file_exists($session_sok);
			}
		}
		
		
		
		static function create($client_key){
			global $config;
			
			$temp_id = md5(microtime().rand());
			
			if($config['memcache_use']){
				$host_key = 'hostcount_'.$client_key;
				$count = (int)GLOB::$mc->get($host_key);
				if($count > $config['connections_per_host']) return false;
				
				// Save the sid into memcached for the ircbot to pick up
				GLOB::$mc->add('sid_'.$temp_id, $temp_id);
			}
			
			$session_cmd = "{$config['php_path']} {$config['session_script_path']} $temp_id $host_key -h$client_key";
			//die($session_cmd);
			$session_status  = `$session_cmd`;
			
			if($session_status != 'ok'){
				debug("Failed creating session socket with: $session_status");
				GLOB::$mc->delete('sid_'.$temp_id);
				return false;
			}
			
			if($config['memcache_use']){
				GLOB::$mc->add($host_key, 0);
				GLOB::$mc->increment($host_key);
			}
			
			return $temp_id;
		}
		
		
		
		static function open($session_id){
			global $config;
			
			if($config['memcache_use']){
				$session_sok = GLOB::$mc->get('sid_'.$session_id);
				if(!$session_sok) return false;
			} else {
				$session_sok = $session_id;
			}
			$session_sok = $config['sok_dir'].$config['sok_prefix'].$session_sok;
			
			$sok = @stream_socket_client('unix://'.$session_sok, $errno, $errstr);
			
			if(!$sok) return false;
			return $sok;
		}
		
		
		
		static function close($session){
			fclose($session);
		}
		
		
		static function read($session, $block=true){
			fwrite($session, json_encode(array('method'=>'read')));
			
			if(!$block){
				stream_set_timeout($session, 0, 100000);
			} else {
				stream_set_timeout($session, 120, 0);
			}
			$data = fgets($session);
			
			return $data;
		}
		
		
		
		
		
		static function clStart($session_id){
			global $config;
			
			if($config['memcache_use']){
				$session_sok = GLOB::$mc->get('sid_'.$session_id);
				if(!$session_sok) return false;
			} else {
				$session_sok = $session_id;
			}
			$session_sok = $config['sok_dir'].$config['sok_prefix'].$session_sok;
			
			$sok = stream_socket_server('unix://'.$session_sok, $errno, $errstr);
			if(!$sok) return false;
			
			return $sok;
			 
		}
		
		
		static function clStop($session){
			fclose($session);
		}
	}

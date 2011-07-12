<?php
	
	/*
	 * This script takes a WebSocket connection from a web client, creates a
	 * new session and simply proxies the data between the 2 connections. No
	 * data processing is done here at all.
	 * 
	 */
	
	
	$msg = <<<MSG
	
	
######################################################
    Lol, Kiwi websocket support is starting.

                    Support: support@kiwiirc.com
######################################################

MSG;
	echo $msg;
	
	
	$debug = true;
	
	// Stores the sockets in pairs, websocket=>ircsocket
	$pairs = array();
	
	// Stores all sockets
	$soks = array();
	
	// Handshaken sockets
	$handshakes = array();

	
	
	require(dirname(__FILE__).'/config.php');
	require(dirname(__FILE__).'/common.php');
	require(dirname(__FILE__).'/class_session.php');
	
	
	error_reporting(E_ALL);
	set_time_limit(0);
	ob_implicit_flush();
	
	$server = WebSocket($config['websocket']['bind_addr'], $config['websocket']['bind_port']);
	$soks[(int)$server] = $server;
	$last_dump = 0;
	while(1){
		echo time()." - $last_dump (".(time() - $last_dump).")\n";
		if(time() - $last_dump >= 3){
			$last_dump = time();
			echo "\nPairs: ";
			var_dump($pairs);
			
			echo "\nSoks: ";
			var_dump($soks);
		}
		
		$changed = $soks;
		stream_select($changed, $write=NULL, $except=NULL, NULL);
		
		foreach($changed as $socket){
			// New connection?
			if($socket == $server){
				$client = stream_socket_accept($server);
				if($client<0){
					console("socket_accept() failed"); continue;
				} else {
					connect($client);
				}
			} else {
			
				$buffer = fread($socket, 2048);
				if($buffer === false || $buffer == ''){
					// Disconnected
					disconnect($socket);
				} else {
					//$buffer = substr($buffer, 0, strlen($buffer));
					//console("INCOMING:\n".$buffer."########\n");
					if(isset($handshakes[(int)$socket])){
						// websocket upgrade
						dohandshake($socket, $buffer);
					} else {
						// Data transfering..
						transfer($socket, $buffer);
					}
				}
				
			}
		}
	}
	
	
	
	
	function WebSocket($address,$port){
		//$master=socket_create(AF_INET, SOCK_STREAM, SOL_TCP)     or die("socket_create() failed");
		$master = stream_socket_server("tcp://$address:$port")		or die("socket_create() failed");
		//socket_set_option($master, SOL_SOCKET, SO_REUSEADDR, 1)  or die("socket_option() failed");
		//socket_bind($master, $address, $port)                    or die("socket_bind() failed");
		//socket_listen($master,20)                                or die("socket_listen() failed");
		echo "Server Started : ".date('Y-m-d H:i:s')."\n";
		echo "Master socket  : ".$master."\n";
		echo "Listening on   : ".$address." port ".$port."\n\n";
		return $master;
	}
	
	
	
	
	
	function connect($socket){
		global $soks, $pairs, $handshakes;

		//$session_id = SESSIONS::create();
		//if(!$session_id) return false;
		
		//$pairs[$socket]= SESSION::open($session_id);

		$soks[(int)$socket] = $socket;
		$handshakes[(int)$socket] = false;
		//array_push($soks, $pairs[$socket]);
		
		console($socket." connection..");
	}

	function disconnect($sok){
		global $soks, $pairs;
		console("disconnected?\n");
		
		$pair = findPair($sok);
		if($pair === false) return false;
		foreach($pair as $websocket => $local_con){			
			@fclose($soks[$websocket]);
			unset($soks[$websocket]);
			
			@fclose($soks[$local_con]);
			unset($soks[$local_con]);
			
			unset($pairs[$websocket]);
		}
		
		console($sok." DISCONNECTED!");
	}
	
	function transfer($sok, $buffer){
		global $soks, $pairs;
		console("Transfering data?\n");
		
		$pair = findPair($sok);
		if($pair === false) return false;
		
		console("Transfering ".strlen($buffer)." bytes.. '".$buffer."'");
		//$buffer = wrap($buffer);
		foreach($pair as $websocket => $local_con){
			if($sok == $soks[$websocket]){
				// From websocket..
				fwrite($soks[$local_con], unwrap($buffer));
				break;
			} elseif($sok == $soks[$local_con]){
				// From irc client
				fwrite($soks[$websocket], chr(0).$buffer.chr(255));
				break;
			}
		}
	}
	
	function findPair($socket){
		global $soks, $pairs;
		console("Finding pair: ".(int)$socket."\n");
		
		// If it's a websocket, then this will find it..
		if(isset($pairs[(int)$socket]))
			return array((int)$socket=>$pairs[(int)$socket]);
		
		// If it's an irc client socket, then we will find it when flipped..
		$flipped = array_flip($pairs);
		if(isset($flipped[(int)$socket]))
			return array($flipped[(int)$socket] => (int)$socket);
		
		return false;
	}

	function dohandshake($sok, $buffer){
		global $handshakes, $soks, $pairs;
		console("\nRequesting handshake...");
		
		console("Handshaking...");
		/*
		list($resource, $host, $origin) = getheaders($buffer);
		$upgrade  = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" .
				  "Upgrade: WebSocket\r\n" .
				  "Connection: Upgrade\r\n" .
				  "WebSocket-Origin: " . $origin . "\r\n" .
				  "WebSocket-Location: ws://" . $host . $resource . "\r\n" .
				  "\r\n";
		*/
		if(!strpos($buffer, 'WebSocket-Key1:')){
			$upgrade = (string)new WebSocket75($buffer);
		} else {
			$upgrade = (string)new WebSocket76($buffer);
		}
		
		fwrite($sok, $upgrade.chr(0));
		
		// Done the handshake so remove it from the handshaking array
		unset($handshakes[(int)$sok]);
		
		console("Done handshaking...");
		
		//socket_getsockname($sok, $sok_name);
		$sok_name = stream_socket_get_name($sok, true);
		$session_id = SESSIONS::create($sok_name);
		if(!$session_id) return false;
		$irc_client_sok = SESSIONS::open($session_id);
		
		$soks[(int)$irc_client_sok] = $irc_client_sok;
		$pairs[(int)$sok] = (int)$irc_client_sok;
		
		fwrite($irc_client_sok, json_encode(array('method'=>'read')));
		
		console($sok." CONNECTED!");
		return true;
	}
	
	
	
	
	
	class WebSocket75 {
		private $__value__;
		
		public function __toString() {
			return $this->__value__;
		}
		
		public function __construct($buffer){
			list($resource, $host, $origin) = $this->getheaders($buffer);
			$upgrade  = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n" .
				  "Upgrade: WebSocket\r\n" .
				  "Connection: Upgrade\r\n" .
				  "WebSocket-Origin: " . $origin . "\r\n" .
				  "WebSocket-Location: ws://" . $host . $resource . "\r\n" .
				  "\r\n";
				  
			$this->__value__ = $upgrade;
		}
		
		private function getheaders($req){
			$r=$h=$o=null;
			if(preg_match("/GET (.*) HTTP/"   ,$req,$match)){ $r=$match[1]; }
			if(preg_match("/Host: (.*)\r\n/"  ,$req,$match)){ $h=$match[1]; }
			if(preg_match("/Origin: (.*)\r\n/",$req,$match)){ $o=$match[1]; }
			return array($r,$h,$o);
		}
	}
	
	
	class WebSocket76 {

		/*! Easy way to handshake a WebSocket via draft-ietf-hybi-thewebsocketprotocol-00
		 * @link    http://www.ietf.org/id/draft-ietf-hybi-thewebsocketprotocol-00.txt
		 * @author  Andrea Giammarchi
		 * @blog    webreflection.blogspot.com
		 * @date    4th June 2010
		 * @example
		 *          // via function call ...
		 *          $handshake = WebSocketHandshake($buffer);
		 *          // ... or via class
		 *          $handshake = (string)new WebSocketHandshake($buffer);
		 *
		 *          socket_write($socket, $handshake, strlen($handshake));
		 */

		private $__value__;

		public function __construct($buffer) {
			$resource = $host = $origin = $key1 = $key2 = $protocol = $code = $handshake = null;
			preg_match('#GET (.*?) HTTP#', $buffer, $match) && $resource = $match[1];
			preg_match("#Host: (.*?)\r\n#", $buffer, $match) && $host = $match[1];
			preg_match("#Sec-WebSocket-Key1: (.*?)\r\n#", $buffer, $match) && $key1 = $match[1];
			preg_match("#Sec-WebSocket-Key2: (.*?)\r\n#", $buffer, $match) && $key2 = $match[1];
			preg_match("#Sec-WebSocket-Protocol: (.*?)\r\n#", $buffer, $match) && $protocol = $match[1];
			preg_match("#Origin: (.*?)\r\n#", $buffer, $match) && $origin = $match[1];
			preg_match("#\r\n(.*?)\$#", $buffer, $match) && $code = $match[1];
			$this->__value__ =
				"HTTP/1.1 101 WebSocket Protocol Handshake\r\n".
				"Upgrade: WebSocket\r\n".
				"Connection: Upgrade\r\n".
				"Sec-WebSocket-Origin: {$origin}\r\n".
				"Sec-WebSocket-Location: ws://{$host}{$resource}\r\n".
				($protocol ? "Sec-WebSocket-Protocol: {$protocol}\r\n" : "").
				"\r\n".
				$this->_createHandshakeThingy($key1, $key2, $code)
			;
		}

		public function __toString() {
			return $this->__value__;
		}
		
		private function _doStuffToObtainAnInt32($key) {
			return preg_match_all('#[0-9]#', $key, $number) && preg_match_all('# #', $key, $space) ?
				implode('', $number[0]) / count($space[0]) :
				''
			;
		}

		private function _createHandshakeThingy($key1, $key2, $code) {
			return md5(
				pack('N', $this->_doStuffToObtainAnInt32($key1)).
				pack('N', $this->_doStuffToObtainAnInt32($key2)).
				$code,
				true
			);
		}
	}
	
	
function     say($msg=""){ echo $msg."\n"; }
function    wrap($msg=""){ return chr(0).$msg.chr(255); }
function  unwrap($msg=""){ return substr($msg,1,strlen($msg)-2); }
function console($msg=""){ global $debug; if($debug){ echo time().' '.trim($msg)."\n"; } }

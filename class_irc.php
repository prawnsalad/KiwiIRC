<?php

class SocketStream {
    var $stream;
    function __construct($host = null, $port = null, $blocking = true) {
        if(!$host && !$port)
            return;
        $scheme = 'tcp';
        if($host{0}=='!')
        {
                $scheme = 'ssl';
                $port = 6697;
                $host = substr($host, 1);
        }    
        $this->stream = @stream_socket_client("{$scheme}://$host:$port", $errno, $errstr, 4);
        if(!$this->stream)
        {
            debug("Error creating socket: $host $errstr\n");
            return;
        }
//        socket_set_timeout($this->stream, 30);
        stream_set_blocking($this->stream, $blocking);
    }
    function __destruct()
    {
        if($this->stream)
        {
            fclose($this->stream);
            $this->stream = null;
        }
    }
    function SetBlocking($blocking = true)
    {
        if(!$this->stream)
            return false;
        stream_set_blocking($this->stream, $blocking);
    }
    function SetTimeout($timeout, $ms=0)
    {
        if(!$this->stream)
            return false;
        stream_set_timeout($this->stream, $timeout, $ms);
    }
    function Eof()
    {
        if(!$this->stream)
            return true;
        $x = stream_get_meta_data($this->stream);
        if($x['eof'] && $x['unread_bytes']==0 && feof($this->stream))
            return true;
        return false;
    }
    function Read($length = 512, $type = PHP_BINARY_READ)
    {
        if(!$this->stream) return false;
        if($type == PHP_NORMAL_READ){
            $ret = fgets($this->stream, $length);
        } elseif($type == PHP_BINARY_READ) {
            $ret = fread($this->stream, $length);
        }
		//file_put_contents('/home/wok/public_html/kiwi/rawlog', '> '.$ret, FILE_APPEND);
		return $ret;
    }
    function Write($data)
    {
        global $totalup;
        if(!$this->stream) return false;
		
		//file_put_contents('/home/wok/public_html/kiwi/rawlog', '< '.$data, FILE_APPEND);
        $x = @fwrite($this->stream, $data);
        return $x;
    }
    function GetInfo()
    {
        if(!$this->stream)
            return false;
        return array('local'=>stream_socket_get_name($this->stream,false),'remote'=>stream_socket_get_name($this->stream, true));
    }
}
class SocketStreamSSL extends SocketStream
{
    function __construct($host = null, $port = null, $blocking = true)
    {
        if(!$host && !$port)
            return;
        $this->stream = @stream_socket_client("ssl://$host:$port", $errno, $errstr, 4);
        if(!$this->stream)
        {
            debug("Error creating socket: $host $errstr\n");
            return;
        }
//        socket_set_timeout($this->stream, 30);
        stream_set_blocking($this->stream, $blocking);
    }
}
class IRC
{
    var $stream;
    var $url, $urlinfo;
    var $nick;
    protected $msgqueue = array();
    protected $dccs = array();
    private $reconnect=0;
    private $nextping=0;
    public $modes;
    public $chanlist;
	public $connected;
    function __construct($url, $kiwi=null, $opts=array()){		
        $this->url = $url;
        $urlinfo = parse_url($url);
        $this->urlinfo = $urlinfo;
        if(!ereg("^ircs?$", $urlinfo['scheme']))
            return false;
        $ssl = ($urlinfo['scheme']=='ircs');
        $host = $urlinfo['host'];
        $port = isset($urlinfo['port'])?$urlinfo['port']:6667;
        $this->nick = $nick = isset($urlinfo['user'])?$urlinfo['user']:'kiwi_user|'.(string)rand(0,9999);
        //$ident = isset($urlinfo['pass'])?$urlinfo['pass']:$nick;
		$ident = (isset($opts['ident'])) ? "{$opts['ident']}_kiwi" : "{$nick}_kiwi";
        $chans = false;
        if(isset($urlinfo['path'])){
            $path = trim($urlinfo['path'], "/");
            $chans = explode(",", $path); //"#".str_replace(array(":", ","), array(" ", ",#"), $path);
        }
		$this->connected = false;
        if($ssl)
            $this->stream = new SocketStreamSSL($host, $port, false);
        else
            $this->stream = new SocketStream($host, $port, false);
        if(!$this->stream || !$this->stream->stream){
            return false;
        }
		
		// Send the login data
		if($kiwi != null) $this->stream->Write($kiwi."\r\n");
        if(isset($urlinfo['fragment'])) $this->stream->Write("PASS {$urlinfo['fragment']}\r\n");
		
        $this->stream->Write("NICK $nick\r\n");
        $this->stream->Write("USER $ident 0 0 :$nick\r\n");
        //if($chans){
        //    foreach($chans as $chan)
        //        $this->stream->Write("JOIN ".str_replace(":", " ", $chan)."\r\n");
        //} else {
			$chans = array();
		//}
        $this->chans = $chans;
		$this->connected = true;
        return true;
    }
    function __destruct(){
        if($this->stream){
            $this->stream->Write("QUIT :kiwi\r\n");    
        }
    }
    function Process(){
        if((!$this->stream || !$this->stream->stream)){
            if(time() > $this->reconnect) {
            $this->__construct($this->url);
            $this->reconnect = time() + 10;
            }
            usleep(50000);
            return;
        }
        if($this->stream->Eof()){
            $this->stream = null;
            return;
        }
        $r=array($this->stream->stream);
		$w = $e = array();
        if(($num=@stream_select($r, $w,$e,0,50000))===false){
            
        } elseif($num>0){
            $data=$this->stream->Read(512, PHP_NORMAL_READ);
		//deb($data);
            if(preg_match("/^(?::(?:([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)|([a-z0-9\x5B-\x60\x7B-\x7D\.\-]+)!([a-z0-9~\.\-_|]+)@([a-z0-9\.\-:]+)) )?([a-z0-9]+)(?:(?: ([^:]+))?(?: :(.+))?)$/i", $data, $regs))
            {
                    unset($prefix, $nick, $ident, $hostname, $command, $params, $trailing, $flarp);
                    $prefix = $regs[1];
                    $nick = $regs[2];
                    $ident = $regs[3];
                    $hostname = $regs[4];
                    $command = $regs[5];
                    $params = isset($regs[6]) ? $regs[6] : '';
                    $trailing = trim(isset($regs[7]) ? $regs[7] : '');
                    $flarp = compact('prefix', 'nick', 'ident', 'hostname', 'command', 'params', 'trailing');
                    $this->ProcessMessage($flarp);
            }
        }
        else
        {
            if(sizeof($this->msgqueue) && (microtime(true)>($this->lastqueuewrite+0.1)) && ($msg=array_shift($this->msgqueue)))
            {    $this->lastqueuewrite = microtime(true); $this->stream->Write($msg); }
            foreach($this->dccs as $k=>&$dcc)
            {
                if(!$dcc->Process())
                {
                    if($dcc->errorinfo)
                        $this->SendNotice($dcc->errorinfo['nick'], $dcc->errorinfo['text']);
                    unset($this->dccs[$k]);
                }
            }
            if(($now=microtime(1))>$this->nextping)
            {
                $this->stream->Write("PONG x\r\n");
                $this->nextping = $now + 150;
            }
        }
    }
    function ProcessMessage($message)
    {
        //echo $message['command']."\n";
        switch($message['command'])
        {
            case "PING":
                $this->stream->Write("PONG {$message['trailing']}\r\n");
            break;
            case "PRIVMSG":
                $this->ProcessPrivMsg($message);
            break;
            case "001":
            if($this->chans)
                foreach($this->chans as $chan)
                    $this->stream->Write("JOIN ".str_replace(":", " ", $chan)."\r\n");
            break;
            case "443":
                $newnick = 'kiwi_user|'.rand(0,99999);
                $this->SendCmd("NICK ".$newnick);
                $this->nick = $newnick;
            break;
            case "MODE":
                $this->OnMODE($message);
            break;
            case "353":
                $this->On353($message);
				break;
			case "QUIT":
				$chan = $message['params'];
				foreach($this->chanlist as &$chan){
					if(isset($chan['userlist'][$message['nick']]))
						unset($chan['userlist'][$message['nick']]);
				}
				break;
			case "PART":
				$chan = $message['params'];
				//debug("Parting {$message['nick']} from $chan");
				if(isset($this->chanlist[ltrim($chan, "#")])){
					unset($this->chanlist[ltrim($chan, "#")]['userlist'][$message['nick']]);
				}
				break;
			case "JOIN":
				$chan = $message['trailing'];
				$nick = array($message['nick'] => '');
				$nicklist = is_array($this->chanlist[ltrim($chan, "#")]['userlist']) ? $this->chanlist[ltrim($chan, "#")]['userlist'] :
																						array();
				
				$this->chanlist[ltrim($chan, "#")]['userlist'] = array_merge($nicklist, $nick);
				break;
			case "NICK":
				if($message['nick'] == $this->nick){
					$this->nick = $message['trailing'];
				}
				foreach($this->chanlist as $chan_name => $chan){
					foreach($chan['userlist'] as $nick => $status){
						if($nick == $message['nick']){
							$this->chanlist[$chan_name]['userlist'][$message['trailing']] = $this->chanlist[$chan_name]['userlist'][$message['nick']];
							unset($this->chanlist[$chan_name]['userlist'][$message['nick']]);
							break;
						}
					}
				}
				break;
        }
    }
    function OnMODE($message){
		if($message['params'] == $this->nick) {
			$modes = $message['trailing'];
			$size = strlen($modes);
			$add = 1;
			for($i=0;$i<$size;$i++){
				if($modes{$i} == '+'){
					$add = 1;
					continue;
				} elseif($modes{$i} == '-'){
					$add = 0;
					continue;
				}
				if($add && strpos($this->modes, $modes{$i}) === false)
					$this->modes.=$modes{$i};
				if(!$add && strpos($this->modes, $modes{$i}))
					$this->modes = str_replace($modes{$i}, "", $this->modes);
			}
		}
		$params = $message['params'];
		$chan = trim(strtok($params, ' '));
		if(in_array(trim($chan,'#'), $this->chans)){
			$modes = strtok(' ');
			$therest = explode(" ", trim(strtok('')));
			$size = strlen($modes);
			$add = 1;
			$offset = 0;
			for($i=0;$i<$size;$i++){
				if($modes{$i} == '+'){
					$add = 1;
					$offset--;
					continue;
				} elseif($modes{$i} == '-'){
					$add = 0;
					$offset--;
					continue;
				}
					if($modes[$i]=='v')
					{
						$user = $therest[$i+$offset];
						if($add)
						{
							if(stripos($this->chanlist[trim($chan,'#')]['userlist'][$user], '+')===false)
								$this->chanlist[trim($chan,'#')]['userlist'][$user] .= '+';
						}
						else
							$this->chanlist[trim($chan,'#')]['userlist'][$user] = str_replace('+','',$this->chanlist[trim($chan,'#')]['userlist'][$user]);
						continue;
					}
					if($modes[$i]=='o')
					{
						$user = $therest[$i+$offset];
						if($add)
						{
							if(stripos($this->chanlist[trim($chan,'#')]['userlist'][$user], '@')===false)
								$this->chanlist[trim($chan,'#')]['userlist'][$user] .= '@';
						}
						else
							$this->chanlist[trim($chan,'#')]['userlist'][$user] = str_replace('@','',$this->chanlist[trim($chan,'#')]['userlist'][$user]);
						continue;
					}
					if($modes[$i]=='h')
					{
						$user = $therest[$i+$offset];
						if($add)
						{
							if(stripos($this->chanlist[trim($chan,'#')]['userlist'][$user], '%')===false)
								$this->chanlist[trim($chan,'#')]['userlist'][$user] .= '%';
						}
						else
							$this->chanlist[trim($chan,'#')]['userlist'][$user] = str_replace('%','',$this->chanlist[trim($chan,'#')]['userlist'][$user]);
						continue;
					}
					if($modes[$i]=='q')
					{
						$user = $therest[$i+$offset];
						if($add)
						{
							if(stripos($this->chanlist[trim($chan,'#')]['userlist'][$user], '~')===false)
								$this->chanlist[trim($chan,'#')]['userlist'][$user] .= '~';
						}
						else
							$this->chanlist[trim($chan,'#')]['userlist'][$user] = str_replace('~','',$this->chanlist[trim($chan,'#')]['userlist'][$user]);
						continue;
					}
			}
		}
		
	}
	function On353($message){
		// Response to NAMES command
		list($nick,,$chan) = explode(" ", $message['params']);
		$nicks = explode(" ", $message['trailing']);
		$prefixes = array('~', '&', '@','%','+');
		$nicklist = array();
		foreach($nicks as $nick){
			if(in_array($nick{0}, $prefixes)){
				$prefix = $nick{0};
				$nick = substr($nick,1);
			}
			else
				$prefix = '';
			$nicklist[$nick] = $prefix;
		}
		if(sizeof($nicklist)){
			// If we havn't got a list of nicks for this channel yet, create it
			if(!isset($this->chanlist[ltrim($chan, "#")]['userlist'])){
				$this->chanlist[ltrim($chan, "#")]['userlist'] = array();
			}
			$this->chanlist[ltrim($chan, "#")]['userlist'] = array_merge($this->chanlist[ltrim($chan, "#")]['userlist'], $nicklist);
		}
	}
    function ProcessPrivMsg($message){
                //$cmd = strtok($message['trailing'], ' ');
                //switch($cmd){
                //}
    }
    function SendMessage($dest, $text){
        if(!$this->stream)
            return false;
        $this->stream->Write("PRIVMSG $dest :$text\r\n");
    }
	function Join($chan){
		$this->stream->Write("JOIN ".str_replace(":", " ", $chan)."\r\n");
	}
    function SendNotice($dest, $text)
    {
        $this->stream->Write("NOTICE $dest :$text\r\n");
    }
    function QueueMessage($dest, $text)
    {
        $this->msgqueue[] = "PRIVMSG $dest :$text\r\n";
    }
    function QueueNotice($dest, $text)
    {
        $this->msgqueue[] = "NOTICE $dest :$text\r\n";        
    }
    function GetMainChan()
    {
        return '#'.$this->chans[0];    
    }
}
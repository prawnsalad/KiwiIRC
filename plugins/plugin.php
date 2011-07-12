<?php
	
	class Plugin {
		var $name = "Kiwi Plugin";
		var $onload = "function(){}";
		var $onunload = "function(){}";
		var $onprivmsg = "function(inp, tabview){}";
		
		public function export(){
			//header("Content-Type: application/json");
			return json_encode(array(
				'name'=>$this->name,
				'onprivmsg'=>$this->onprivmsg,
				'onload'=>$this->onload,
				'onunload'=>$this->onunload
			));
		}
	}
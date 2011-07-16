<?php

	function auto_load($class){
		try	{
			$file = str_replace('_', '/', strtolower($class));
			$path = 'libs/'.$file.'.php';

			if (file_exists($path)){
				require $path;
				return true;
			}

			return false;
		}catch (Exception $e){
			// Err...
		}
	}
	spl_autoload_register('auto_load');



	define('CACHE_DIR', './cache/');

	function cacheReadfile($file){
		if(file_exists(CACHE_DIR.$file)){
			readfile(CACHE_DIR.$file);
			exit;
		}
	}

	function writeToCache($file, $data){
		file_put_contents(CACHE_DIR.$file, $data);
	}



	if(isset($_GET['js'])){
		$files = explode(',', $_GET['js']);
		arsort($files);

		$cache_filename = 'js';
		foreach($files as $file) $cache_filename .= '_'.$file;
		cacheReadfile($cache_filename);

		$js = '';
		foreach($files as $file){
	    	$js .= JSMin::minify(file_get_contents("js/$file.js"));
		}
		//writeToCache($cache_filename, $js);
		echo $js;
	}

	
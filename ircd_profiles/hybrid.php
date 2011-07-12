<?php

	/*
	 * Best of all worlds
	 * A collection of response commands from all RFCs.
	 * These selected appears to work best for the most part.
	 */
	
	define('RPL_WHOISUSER', 311);
	define('RPL_WHOISSERVER', 312);
	define('RPL_WHOISOPERATOR', 313);
	define('RPL_WHOISIDLE', 317);
	define('RPL_ENDOFWHOIS', 318);
	define('RPL_WHOISCHANNELS', 319);
	
	define('RPL_MOTD', 372);
	define('RPL_WHOISMODES', 379);					// Unreal. Conflicts.
	
	define('ERR_NOSUCHNICK', 401);
	define('ERR_NOSUCHSERVER', 402);
	define('ERR_NOSUCHCHANNEL', 403);
	define('ERR_CANNOTSENDTOCHAN', 404);
	define('ERR_TOOMANYCHANNELS', 405);
	define('ERR_WASNOSUCHNICK', 406);
	define('ERR_TOOMANYTARGETS', 407);
		
	define('ERR_LINKCHANNEL', 470);
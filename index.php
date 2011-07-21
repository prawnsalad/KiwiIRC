<?php

    $node_config = json_decode(file_get_contents("node/config.json"), true);

    switch(true){
        case stripos($_SERVER['HTTP_USER_AGENT'], 'android') > 0:
            $agent = "android"; $touchscreen = true;
            break;
            
        case stripos($_SERVER['HTTP_USER_AGENT'], 'iphone') > 0:
            $agent = "iphone"; $touchscreen = true;
            break;
            
        case stripos($_SERVER['HTTP_USER_AGENT'], 'ipod') > 0:
            $agent = "ipod"; $touchscreen = true;
            break;
            
        case stripos($_SERVER['HTTP_USER_AGENT'], 'ipad') > 0:
            $agent = "ipad"; $touchscreen = true;
            break;
            
        default:
            $agent = "normal";
            $touchscreen = false;
    }
    
    define("SERVER_SET", isset($_GET['server']));
    $server = isset($_GET['server']) ? $_GET['server'] : "irc.anonnet.org";
    $nick = isset($_GET['nick']) ? $_GET['nick'] : "";
    // Channel is set via javascript using location.hash

    $node_server = $_SERVER['HTTP_HOST'];
    
?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<meta name="viewport" content="width=device-width,user-scalable=no" />
<?php } ?>

<title>Kiwi IRC</title>
<link rel="stylesheet" type="text/css" href="css/default.css">
<link rel="stylesheet" type="text/css" href="css/ui.css">

<?php if($touchscreen){ ?>
<link rel="stylesheet" type="text/css" href="css/touchscreen_tweaks.css">
<?php } ?>

<script src="http://<?php echo $node_server; ?>:7777/socket.io/socket.io.js"></script>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/jquery-ui.min.js"></script>
<script type="text/javascript" src="js/jquery.json-2.2.min.js"></script>
<script type="text/javascript" src="js/util.js"></script>
<script type="text/javascript" src="js/gateway.js"></script>
<script type="text/javascript" src="js/front.js"></script>
<script type="text/javascript" src="js/iscroll.js"></script>

<?php if(in_array($agent, array("android", "ipad", "iphone", "ipad"))){ ?>
<script type="text/javascript" src="js/touchscreen_tweaks.js"></script>
<?php } ?>

<script type="text/javascript">
    var agent = '<?php echo $agent; ?>';
    var touchscreen = <?php echo ($touchscreen) ? 'true' : 'false'; ?>;
    var init_data = {};
    var kiwi_server = '<?php echo ($node_config['listen_ssl'] ? "https" : "http")."://".$node_server; ?>:7777/kiwi';
    var touch_scroll;
    
    $(document).ready(function(){
        manageDebug(false);

        //#channel,##channel,&channel
        var chans = document.location.hash.match(/[#&]+[^ ,\007]+/g);
        if(chans != null && chans.length > 0) {
            init_data.channel = chans.join(',');
            $('#channel').val(init_data.channel);
        }
        
        front.init();
        gateway.start(kiwi_server);
        
        addEvents();
        $('.nick').focus();
    });
    
    
    function addEvents(){
        $('.more_link').click(function(){ $('.content.bottom').slideDown('fast'); $('.network').focus(); return false; });
        $('.formconnectwindow').submit(function(){
            init_data.channel = $('#channel').val();
            return false;
        });
        $('a.connect').click(function(){ $('.formconnectwindow').submit(); return false; });
        $('a.chan').live('dblclick', function() { front.joinChannel($(this).text()); });
    }
</script>


<script id="tmpl_about_box" type="text/x-jquery-tmpl">
    <h2>Kiwi IRC</h2>
    <p>An alternative to downloading an irc client. Kiwi IRC is the best web app you'll use for the next couple years.</p>
    <button class="about_close">Close</button>
    <p class="info">${about}</p>
    <p class="revisions">Front: ${front_revision}<br />Gateway: ${gateway_revision}</p>
</script>

<script id="tmpl_change_nick" type="text/x-jquery-tmpl">
    <div class="newnick box">
        Your new nick:<br />
        <form class="form_newnick">
            <input type="text" class="txtnewnick" /><br />
            <button class="butnewnick" type="submit">Change</button> <a class="link cancelnewnick">Cancel</a>
        </form>
    </div>
</script>


<script id="tmpl_plugins" type="text/x-jquery-tmpl">
    <div class="list">
        <h2>Kiwi plugins</h2>
        <p>
            <select multiple="multiple" id="plugin_list">
            </select>
            <button id="plugins_list_unload">Unload</button>
        </p>
    </div>
    <div class="load">
        Plugin file URL:<br />
        <form>
            <input type="text" class="txtpluginfile" /><br />
            <button class="butnewnick" type="submit">Load..</button> <a class="link cancelpluginfile">Cancel</a>
        </form>
    </div>
</script>

<script id="tmpl_user_box" type="text/x-jquery-tmpl">
    <div class="userbox">
        <input type="hidden" class="userbox_nick" value="${nick}" />
        <a href="#" class="userbox_query">Message</a>
        <a href="#" class="userbox_whois">Info</a>
    </div>
</script>

</head>

<body>

<div id="kiwi">
    <div class="connectwindow">
        <h1 class="logo">Kiwi IRC</h1>
        <div id="login">
            <form class="formconnectwindow">
                <div class="content top">
                    <ul>
                        <li><label for="nick">Your nickname:</label>
                            <input type="text" id="nick" name="nick" class="nick" placeholder="Your nick.." /></li>
                    </ul>
                    <a class="connect" href="">Connect..</a>
                </div>
                
                <div class="more" style="<?php if(SERVER_SET) echo "display:none;"; ?>">
                    <a href="" class="more_link">More</a>
                    <div class="content bottom">
                        <ul>
                            <li><label for="network">Server:</label>
                                <input type="text" id="network" name="network" class="network" value="<?php echo htmlentities($server); ?>" /></li>
                            <li><label for="channel">Channel:</label>
                                <input type="text" id="channel" name="channel" class="channel" value="#kiwiirc" /></li>
                        </ul>
                        <a class="connect" href="">Connect..</a>
                    </div>
                </div>
            </form>
        </div>
    </div>
    
    
    
    <div class="windowlist">
        <div class="poweredby">Powered by Kiwi IRC</div>
        <ul></ul>
    </div>
    
    <div class="cur_topic">
        <!--
        <ul class="edit" style="float:right;">
            <li>
                <img src="img/more.png" />
                <ul id="kiwi_menu">
                    <li>Item 1</li>
                    <li>Item 2</li>
                    <li>Item 3</li>
                </ul>
            </li>
        </ul>
        -->
        <div class="topic" style="margin-right:5em; overflow:hidden; white-space: pre-wrap; word-wrap: break-word;"></div>
    </div>
    
    <div class="userlist">
        <ul></ul>
    </div>
    
    <div id="windows" class="windows"><div class="scroller" style="width:100%;"></div></div>

    <div class="control">
        <div class="msginput">
            <div class="nick"><a href="#"></a>:</div>
            <input type="text" name="kiwi_msginput" id="kiwi_msginput" />
        </div>
        <div class="plugins">
            <ul>
                <li><a class="load_plugin_file">Plugins</a></li>
                <?php if(isset($_GET['debug'])){ ?>
                <li><a class="reload_css">Reload CSS</a></li>
                <?php } ?>
            </ul>
        </div>
    </div>
</div>

</body>
</html>

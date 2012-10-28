var kiwi_app = './server/kiwi.js';


var daemon = require('daemonize2').setup({
    main: kiwi_app,
    name: 'kiwiirc',
    pidfile: 'kiwiirc.pid'
});

switch (process.argv[2]) {
    case '-f':
        require(kiwi_app);
        break;

    case 'start':
        daemon.start();
        break;

    case 'stop':
        daemon.stop();
        break;

    case 'restart':
        daemon.stop(function(err) {
            daemon.start();
        });
        break;

    case 'status':
        var pid = daemon.status();
        if (pid)
            console.log('Daemon running. PID: ' + pid);
        else
            console.log('Daemon is not running.');
        break;


    default:
        console.log('Usage: [-f|start|stop|restart|status]');
}
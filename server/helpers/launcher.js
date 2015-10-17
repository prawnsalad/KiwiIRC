var melon_app = '../melon.js';
var pidfile = '../../melonirc.pid';
var pidfile_arg;

// Check if a pidfile has been set as an argument
if (process.argv.indexOf('-p') > -1) {
    pidfile_arg = process.argv[process.argv.indexOf('-p') + 1];

    if (pidfile_arg) {
        // Don't set the relative path if we have an absolute path given to us
        if (['/', '\\', '.'].indexOf(pidfile_arg[0]) === -1) {
            pidfile = '../../' + pidfile_arg;
        } else {
            pidfile = pidfile_arg;
        }
    }
}


var daemon = require('daemonize2').setup({
    main: melon_app,
    name: 'melonirc',
    pidfile: pidfile
});

switch (process.argv[2]) {
    case '-f':
        require(melon_app);
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

    case 'reconfig':
        console.log('Loading new config..');
        daemon.sendSignal("SIGUSR1");
        break;

    case 'stats':
        console.log('Writing stats to log file..');
        daemon.sendSignal("SIGUSR2");
        break;

    case 'build':
        require('./build.js');
        break;

    default:
        console.log('Usage: [-f|start|stop|restart|status|reconfig|build [-c <config file>] [-p <pid file>]]');
}

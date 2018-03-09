#! /bin/sh
### BEGIN INIT INFO
# Provides:          kiwiirc
# Required-Start:    $named $network $remote_fs $syslog
# Required-Stop:     $named $network $remote_fs $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Starts, stops, restarts, reloads  or returns
#                    status of KiwiIRC.
# Description:       An init script to start, stop, reload or restart
#                    the KiwiIRC web IRC client, or return the current
#                    status.
### END INIT INFO

# Author: Patrick Godschalk <argure@donttrustrobots.nl>

DIR=/usr/local/share/kiwiirc
DESC="Web IRC client"
NAME=kiwiirc
DAEMON=$DIR/kiwi
DAEMON_OPTS=""
DAEMON_USER=irc
PIDFILE=/var/run/kiwiirc.pid

# Exit if the package is not installed.
[ -x "$DAEMON" ] || exit 0

# Read default configuration variable file if it is present.
[ -r /etc/default/$NAME ] && . /etc/default/$NAME

# Define LSB log_* functions.
# Depend on lsb-base (>= 3.2-14) to ensure that this file is present
# and status_of_proc is working.
. /lib/lsb/init-functions

do_start()
{
	log_daemon_msg "Starting system $NAME daemon"
	start-stop-daemon --start --background --pidfile $PIDFILE --make-pidfile --user $DAEMON_USER --chuid $DAEMON_USER --startas $DAEMON start -- $DAEMON_OPTS
	log_end_msg $?
}

do_stop()
{
	log_daemon_msg "Stopping system $NAME daemon"
	# Don't use start-stop-daemon here because kiwiirc forks itself into a new process
	killall $NAME
        rm -r $PIDFILE
	log_end_msg $?
}

do_reload() {
	log_daemon_msg "Reloading system $NAME daemon"
	# Don't use start-stop daemon here because kiwiirc forks itself into a new process
	$DAEMON reconfig
	return 0
}

case "$1" in
  start|stop)
	do_${1}
	;;
  reload)
	do_reload
	;;
  restart|force-reload)
	do_stop
	do_start
	;;
  status)
	status_of_proc "$NAME" "$DAEMON" && exit 0 || exit $?
	;;
  *)
	echo "Usage: $SCRIPTNAME {start|stop|status|restart|reload|force-reload}"
	exit 1
	;;
esac

exit 0

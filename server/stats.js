module.exports = {
    incr: function incr(stat_name, data) {
        global.modules.emit('stat counter', {name: stat_name, data: data});
    },

    gauge: function gauge(stat_name, value) {
        global.modules.emit('stat gauge', {name: stat_name, value: value});
    },


    /**
     * Send a timer value to the stats
     *
     * Usage:
     *     var timer = Stats.startTimer('stat_name', {some_data: 'value'});
     *     // Do stuff
     *     timer.stop({other_data: 'value'});
     *
     * The object passed into .startTimer() and .stop(); are optional. If
     * given they will be shallow merged with .stop() overridding .startTimer()
     */
    startTimer: function statsTimer(stat_name, data_start) {
        var timer_started = new Date();

        var timerStop = function timerStop(data_end) {
            var time = (new Date()) - timer_started;
            var data = shallowMergeObjects(data_start, data_end);

            global.modules.emit('stat timer', {name: stat_name, time: time, data: data});
        };

        return {
            stop: timerStop
        };
    }
};



function shallowMergeObjects(/** argn, ... **/) {
    var arg_idx, arg,
        data = {};

    for(arg_idx=0; arg_idx<arguments.length; arg_idx++) {
        arg = arguments[arg_idx];

        if (!arg) {
            continue;
        }

        for(var prop in arg) {
            if (arg.hasOwnProperty(prop)) {
                data[prop] = arg[prop];
            }
        }
    }

    return data;
}
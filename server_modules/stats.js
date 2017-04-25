/**
 * Stats counter
 *
 * Retreive stats for internal kiwi events. Handy for graphing
 */

var kiwiModules = require('../server/modules'),
    fs = require('fs');



var module = new kiwiModules.Module('stats_file');

var stats_file = fs.createWriteStream('kiwi_stats.log', {'flags': 'a'});

module.on('stat counter', function (event, event_data) {
    var stat_name = event_data.name,
        timestamp,
        ignored_events = [];

    // Some events may want to be ignored
    ignored_events.push('http.request');

    if (ignored_events.indexOf(stat_name) > -1) {
        return;
    }

    timestamp = Math.floor((new Date()).getTime() / 1000);
    stats_file.write(timestamp.toString() + ' ' + stat_name + '\n');
});

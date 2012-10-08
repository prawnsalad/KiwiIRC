/*
 * Example Kiwi module.
 * This is by no means is a production ready module.
 */

var kiwi = require('../kiwi.js');
var stats = {msgs: 0, topic_changes: 0};

exports.onmsgsend = function (msg, opts) {
    stats.msgs++;

    var connections_cnt = 0;
    for (var i in kiwi.connections) {
        connections_cnt = connections_cnt + parseInt(kiwi.connections[i].count, 10);
    }

    if (msg.msg === '!kiwistats') {
        msg.msg = '';
        msg.msg += 'Connections: ' + connections_cnt.toString() + '. ';
        msg.msg += 'Messages sent: ' + stats.msgs.toString() + '. ';
        msg.msg += 'Topics set: ' + stats.topic_changes.toString() + '. ';

        opts.websocket.sendClientEvent('msg', {nick: msg.target, ident: '', hostname: '', channel: msg.target, msg: msg.msg});
        return null;
    }

    return msg;
}

exports.ontopic = function (topic, opts) {
    stats.topic_changes++;

    return topic;
}

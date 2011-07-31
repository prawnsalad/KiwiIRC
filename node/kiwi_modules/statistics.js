/*
 * Example Kiwi module.
 * This is by no means is a production ready module.
 */

var stats = {msgs: 0, topic_changes: 0};

exports.onmsgsend = function (msg, opts) {
    stats.msgs++;

    if (msg.msg === '!kiwistats') {
        msg.msg = 'Messages sent: ' + stats.msgs.toString() + '. ';
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

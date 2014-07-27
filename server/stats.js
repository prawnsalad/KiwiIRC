module.exports = {
    incr: function incr(stat_name) {
        global.modules.emit('stat counter', {name: stat_name});
    }
};
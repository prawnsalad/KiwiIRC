function DefineNRequire() {
    var definitions = Object.create(null);
    var modules = Object.create(null);

    function require(name) {
        var mod_id = normalisePath(name);

        // If this mod_id has been defined but not yet executed, execute it now
        if (!modules[mod_id] && definitions[mod_id]) {
            initModule(mod_id);
        }

        return modules[mod_id];
    }

    function define(name, definition) {
        var mod_id = normalisePath(name);
        definitions[mod_id] = definition;
    }

    function initModule(mod_id) {
        var mod_path_parts = mod_id.split('/');
        var mod_name = mod_path_parts[mod_path_parts.length-1];
        var mod_path = mod_path_parts.slice(0, mod_path_parts.length-1).join('/');
        var module_obj = {exports: {}};

        var requireFn = function(name) {
            var require_name = name;
            if (name[0] === '.') {
                require_name = (mod_path ? mod_path + '/' : '') + name;
            }

            return require(require_name);
        };

        definitions[mod_id](requireFn, module_obj.exports, module_obj);
        modules[mod_id] = module_obj.exports;
    }

    // Normalise '.' and '..' from paths
    function normalisePath(path) {
        var parts = path.splice ? path : path.split('/');
        var normalised = [];
        for (var i=0; i<parts.length; i++) {
            if (parts[i] === '..') {
                normalised.pop();
            } else if (parts[i] === '.') {
                continue;
            } else {
                normalised.push(parts[i]);
            }
        }

        return normalised.join('/');
    }

    return {
        define: define,
        require: require
    };
}
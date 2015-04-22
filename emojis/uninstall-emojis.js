#!/usr/bin/env node
/*
  Emoji uninstaller - Remove emojis created by install-emojis.js

  Usage: ./uninstall-emojis
*/
var https = require('https'),
    fs = require('fs'),
    path = require('path'),
    args = process.argv.slice(2);

/*
  Files and folders to remove.
*/
var paths = {
    img:    { path: '/../client/assets/img/emojis/', dir: true },
    js:     { path: '/../client/src/helpers/emojis.js' },
    plugin: { path: '/../client/assets/plugins/emojis.html' }
};
Object.keys(paths).forEach(function (name) {
   paths[name].path = __dirname+paths[name].path;
   if (fs.existsSync(paths[name].path)) {
      try {
         if (!paths[name].dir) {
            fs.unlink(paths[name].path,function (err) {
                if (err) {
                   console.trace(err);
                 } else {
                   console.log('Removed '+paths[name].path);
                }
            }); 
          } else {
            (function rmDir (path) {
                fs.readdirSync(path).forEach(function(file, index){
                    var curPath = path+file;
                    if (fs.lstatSync(curPath).isDirectory()) {
                       rmDir(curPath);
                     } else {
                       fs.unlink(curPath,function (err) {
                           if (err) {
                              console.trace(err);
                            } else {
                              console.log('Removed '+curPath);
                           }
                       });
                    }
                });
                fs.rmdir(path,function (err) {
                    if (err) {
                       console.trace(err);
                     } else {
                       console.log('Removed '+path);
                    }
                });
            })(paths[name].path);
         }
       } catch (e) {
         console.trace(e);
         process.exit(1);
      }
    } else {
      console.warn('File or folder not found: '+JSON.stringify(paths[name]));
      process.exit(1);
   }
});

#!/usr/bin/env node
/*
  Emoji Generator - Create a compatible Emoji list based on http://www.emoji-cheat-sheet.com/
  https://github.com/arvida/emoji-cheat-sheet.com

  Usage: install-emojis [--overwrite] [--concurrent=NUM]
  Note: Without a github username for basic authentication there is a ratelimit!
*/
var https = require('https'),
    fs = require('fs'),
    path = require('path'),
    args = process.argv.slice(2);

/*
  Files and folders to install.
*/
var paths = {
    img:     '/../client/assets/img/emojis/',
    js:      '/../client/src/helpers/emojis.js',
    plugin:  '/../client/assets/plugins/emojis.html', 
};
Object.keys(paths).forEach(function (name) {
   paths[name] = __dirname+paths[name];
});
if (!fs.existsSync(paths.img)) {
   try {
      fs.mkdirSync(paths.img);
    } catch (e) {
      console.trace(e);
      process.exit(1);
   }
}

/*
  Parse argv for settings.
*/
var settings = {
    overwrite: false,
    concurrent: 10,
};
args.forEach(function (arg) {
    var match = null;
    if (arg === '--overwrite') {
       settings.overwrite = true;
    } else if ((match = arg.match(/--concurrent=(\d+)/i))) {
       settings.concurrent = parseInt(match[1],10)
    }
});

/*
  Query GitHub for emoji names and paths, then download them.
*/
var emojis = {
    alts: {'+1':'plus1','black_large_square':'black_square'}, // Remap specific emoji files.
}
var endpoint = 'https://raw.githubusercontent.com/arvida/emoji-cheat-sheet.com/master/public/',
    files = [];
console.log('Requesting Emojis list for GitHub...');
https.get(endpoint+'index.html',function (res) {
     if (res.statusCode === 200) {
         var buf = [];
         res.on('data', function(chunk) {
             buf.push(chunk);
          }).on('end',function () {
             try {
                var data = buf.join('').replace(/\r?\n/g,''),
                    matches = null;
                if ((matches = data.match(/<ul class="([^\s]+) emojis" id="emoji-([^"]+)">(.+?)<\/ul>/gmi))) {
                   matches.forEach(function (str) {
                       var cat = /<ul class="([^\s]+) emojis"/i.exec(str)[1],
                           reg = /<li><div><img src="([^>]+)"> :<span class="name"(?: data-alternative-name="(?:[^"]+)")?>([^<]+)<\/span>:<\/div><\/li>/gi;
                       if (cat) {
                          var result = [], match;
                          while ((match = reg.exec(str)) !== null) {
                                files.push({link: endpoint+match[1], name: path.basename(match[1]), emoji: match[2]});
                                result.push(match[2]);
                          }
                          emojis[cat] = result;
                          console.log('Found '+result.length+' "'+cat+'" emojis!');
                      }
                   });
                   var opts = {
                       id: 0,
                       requests: {},
                       overwrite: false,
                       files: files,
                       found: []
                   };
                   console.log('Found '+opts.files.length+' possible Emojis; Downloading '+settings.concurrent+' concurrently, this may take some time.');
                   function runDownload () {
                            return download();
                   }
                   for (var idx = 0; idx < settings.concurrent; idx++) {
                       runDownload();
                   };
                   function download () {
                            var file = opts.files[opts.id++];
                            if (!file) {
                               if (!Object.keys(opts.requests).length) {
                                  runDownload = function(){};
                                  console.log('Downloaded '+opts.found.length+' images; Installing emojis.js.');
                                  try {
                                     var jsp = __dirname+'/src/emojis.js';
                                     if (fs.existsSync(jsp)) {
                                        try {
                                           if (fs.existsSync(paths.js)) {
                                              fs.unlinkSync(paths.js);
                                           }
                                           fs.createReadStream(jsp).pipe(fs.createWriteStream(paths.js));
                                           console.log('Creating emojis.html plugin; Remember to add emojis.html to your config!');
                                           var plugin = __dirname+'/src/plugin.html';
                                           if (fs.existsSync(plugin)) {
                                              var data = fs.readFileSync(plugin).toString();
                                              var format = {
                                                  date: new Date(),
                                                  count: opts.found.length,
                                              };
                                              Object.keys(emojis).forEach(function (key) {
                                                  format[key] = JSON.stringify(emojis[key]);
                                              });
                                              fs.writeFileSync(paths.plugin,formatter(data,format));
                                              if (!fs.existsSync(paths.plugin)) {
                                                 console.warn('Failed installing pluign to '+paths.plugin);
                                              }
                                            } else {
                                              console.warn('Could not find plugin.html!');
                                           }
                                         } catch (e) {
                                           console.trace(e);
                                           process.exit(1);
                                        }
                                      } else {
                                        console.warn('Could not find emojis.js! -- Stopping.');
                                        process.exit(1);  
                                     }
                                     console.log('Emojis installed!');
                                   } catch (e) {
                                     console.trace(e);
                                  }
                                  return true;
                               }
                               return false;
                            }
                            if (!/\.png$/i.test(file.name)) {
                               return runDownload();
                            }
                            file.id = opts.id;
                            file.__path = paths.img+file.name;
                            if (fs.existsSync(file.__path)) {
                               if (settings.overwrite) {
                                  try {
                                     fs.unlinkSync(file.__path);
                                   } catch (e) {
                                     console.trace(e);
                                  }
                                } else {
                                  opts.found.push(file.name);
                                  return runDownload();
                               }
                            }
                            opts.requests[file.id] = https.get(file['link'], function(res) {
                                 if (res.statusCode == 200 && res.headers['content-type'] === 'image/png') {
                                    res.pipe(fs.createWriteStream(file.__path)).on('close',function () {
                                       opts.found.push(file.name);
                                       delete opts.requests[file.id];
                                       runDownload();
                                     }).on('error',function (e) {
                                       console.trace(e);
                                       delete opts.requests[file.id];
                                       runDownload();
                                    });
                                  } else {
                                    console.log(file['name']+' is invalid! (Code: '+res.statusCode+'; Content-Type: '+res.headers['content-type']+')');
                                 }
                             }).on('error',function (e) {
                                 console.trace(e);
                                 delete opts.requests[file.id];
                                 runDownload();
                            });
                   }
                 } else {
                   console.warn('Invalid content retrieved from GitHub!');
                }
              } catch (e) {
                console.trace(e);
             }
         });
     } else  {
       console.warn('Invalid status code from GitHub! - '+res.statusCode+' ('+(require('http').STATUS_CODES[res.statusCode]||'Unknown status code.')+')');
       process.exit(1);
    }
});
function formatter (str, values) {
         return str.replace(/{(?:\\?:)([^|}]+)(?:\|([^|}]+))?}/g,function(match, key, opt) {
                return (values[key]?values[key]:(opt?opt:match));
         });
}

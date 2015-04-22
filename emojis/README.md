Emojis Installer & Updater
====
This is a basic emojis installer and uninstaller! The installer creates a plugin compatible with [Emoji Cheat Sheet]. The Emoji Cheat Sheet is available [GitHub]. Not all emojis have unicode support, so they require the strings, such as `:trollface:`.

What this does:
====
This index and downloads the list of emojis from the Emoji Cheat Sheet GithHub.
After that, it copies `src/emojis.js` into `../client/src/helpers/` which is used to convert strings (`:smile:`) and unicode into Emojis! This then automatically creates a plugin to list emojis, installed into: `../client/assets/plugins/emojis.html`

To use, run the installer and rebuild KiwiIRC with  `./kiwi build` and add `emojis.html` into your configruation.
```javascript
conf.client_plugins = [
     // "/kiwi/client/assets/plugins/plugin_example.html",
     "/kiwi/client/assets/plugins/emojis.html",
];
```

Install & Update:
====
```bash
   ./install-emojis.js [--concurrent=NUM] [--overwrite]`
```
  * --concurrent=NUMBER 
   * How many images to download at the same time. This can be slow, be patient!
  * --overwrite
   * Overwrite all existing emojis.

Uninstall:
====
Please note, you must rebuild Kiwi IRC to fully remove emoji support.
```bash
   ./uninstall-emojis.js
```

[Emoji Cheat Sheet]:http://emoji-cheat-sheet.com/
[GitHub]:https://github.com/arvida/emoji-cheat-sheet.com

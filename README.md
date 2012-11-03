### Kiwi IRC - A hand-crafted IRC client
Kiwi IRC is a fully featured IRC client that can be extended to suit almost any needs.
Using the web application is extremly simple even without any IRC knowledge as all the common needs are built directly into the UI.

For more information see http://kiwiirc.com or an example of the application can be found at http://kiwiirc.com/client/


### Installation

1. Download the Kiwi source or clone the git repository:

    `$ git clone git@github.com:prawnsalad/KiwiIRC.git`

2. Install the dependancies and make sure the client code is built:
    
    `$ npm install`

    `$ node client/assets/dev/build.js`

3. Edit the configuration file as needed:

    `$ nano config.js`


### Running
From the source folder: `$ ./kiwi start`

You can also run kiwi in the foreground to see any output by using the `-f` flag. Eg: `$ ./kiwi -f`


### Bugs
Report bugs using the issue tracker on github: https://github.com/prawnsalad/KiwiIRC/issues

### Licence
GNU Affero
http://www.gnu.org/licenses/agpl.html


### Thanks to
The KiwiIRC logo credited to Michael Drahony (www.drahony.com)

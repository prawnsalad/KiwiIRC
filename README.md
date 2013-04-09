## Talk with the Experts fork of Kiwi IRC
This is a fork of [Kiwi IRC](https://github.com/prawnsalad/KiwiIRC) for use as the Learnable 'Talk with the Experts' chat room. It provides a Learnable-esque look and feel, and only allows entry to the room #sitepoint on irc.freenode.net.

### Kiwi IRC - A hand-crafted IRC client
Kiwi IRC is a fully featured IRC client that can be extended to suit almost any needs.
Using the web application is extremly simple even without any IRC knowledge as all the common needs are built directly into the UI.

For more information see https://kiwiirc.com or an example of the application can be found at https://kiwiirc.com/client/.
Our development IRC channel is on the Freenode network, irc.freenode.net #kiwiirc


### Installation

1. Download the Kiwi source or clone the git repository:

    `$ git clone git@github.com:prawnsalad/KiwiIRC.git && cd KiwiIRC`

2. Install the dependencies:

    `$ npm install`

3. Copy and edit the configuration file as needed:

    `$ cp config.example.js config.js`

    `$ nano config.js`

4.  Make sure the client code is built:

    `$ ./kiwi build`


### Running
From the source folder: `$ ./kiwi start`

You can also run kiwi in the foreground to see any output by using the `-f` flag. Eg: `$ ./kiwi -f`

Open your new Kiwi instance in your browser. By default: http://localhost:7778/


### Bugs
Report bugs using the issue tracker on github: https://github.com/prawnsalad/KiwiIRC/issues

### Licence
GNU Affero
http://www.gnu.org/licenses/agpl.html


### Thanks to
The KiwiIRC logo credited to Michael Drahony (www.drahony.com)

### Kiwi IRC - A hand-crafted IRC client
Kiwi IRC is a fully featured IRC client that can be extended to suit almost any needs.
Using the web application is extremly simple even without any IRC knowledge as all the common needs are built directly into the UI.

For more information see https://kiwiirc.com or live instance of the application can be found at https://kiwiirc.com/client/.
Our development IRC channel is on the Freenode network, irc.freenode.net #kiwiirc.

**Developing? Please use the development branch - not the master branch!**

[![Visit our IRC channel](https://kiwiirc.com/buttons/irc.freenode.net/kiwiirc.png)](https://kiwiirc.com/client/irc.freenode.net/#kiwiirc)


### Installation

*Note: This requires Node.js to run. Make sure you have installed Node.js first! http://nodejs.org/download/*

1. Download the Kiwi source or clone the git repository:

    `$ git clone https://github.com/prawnsalad/KiwiIRC.git && cd KiwiIRC`

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

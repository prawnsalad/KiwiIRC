# nodebox is a very small node.js image which doesn't support
# building most navtive extension via `node-gpy`. At the time
# of adding this Dockerfile, nodebox works and therefore is
# ideal. Should KiwiIRC requirements change to where native
# extension required, this should be changed to:
#
#  FROM node:v0.12.0
FROM jmervine/nodebox:0.12.0

RUN     mkdir /src
WORKDIR /src
COPY    package.json /src/package.json
RUN     npm install --production
COPY    . /src/

# Copying example configuration.
RUN     cp config.example.js config.js

ENTRYPOINT bash -c './kiwi build && ./kiwi start && tail -f kiwi.log'

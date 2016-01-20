sudo apt-get install npm nodejs -y
cd /vagrant
npm install
cp config.example.js config.js
./kiwi build

rm -rf mediasoup-nodejs
git clone https://github.com/manit77/mediasoup-nodejs.git
cd mediasoup-nodejs
npm install
npm run build
mkdir deploy
cp -rf node_modules deploy/
cp -rf shared/conf-models/dist 

cp -rf conf/conf-server/dist deploy/conf-server

cp client-conf-react-app-config.json build/
sudo rm -rf /var/www/client-conf-react-app
sudo cp -r ~/source/mediasoup-nodejs/client-apps/client-conf-react-app/build /var/www/client-conf-react-app
sudo cp -f ~/source/client-conf-react-app-config.json /var/www/client-conf-react-app

sudo cp ~/source/mediasoup-nodejs/packages/
sudo rm -rf /var/www/conf-server
sudo cp -r  ~/source/mediasoup-nodejs/conf/conf-server/dist /var/www/conf-server/
sudo cp -rf ~/source/mediasoup-nodejs/node_modules /var/www/conf-server
sudo cp -rf ~/source/mediasoup-nodejs/conf-server.env.json /var/www/conf-server/.env.json
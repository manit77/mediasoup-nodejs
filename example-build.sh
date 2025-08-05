rm -rf mediasoup-nodejs    
git clone --depth 1 https://github.com/manit77/mediasoup-nodejs.git
cd mediasoup-nodejs
npm run deploy

cd ..

cp conf-client-app.config.json mediasoup-nodejs/deploy/conf-client-app/config.json 
cp conf-server.env.json mediasoup-nodejs/deploy/conf-server/.env.json
cp conf-server.env.json mediasoup-nodejs/deploy/rooms-server/.env.json

rm -rf /var/www/conf-client-app
rm -rf /var/www/conf-server
rm -rf /var/www/rooms-server

cp -rf mediasoup-nodejs/deploy/. /var/www
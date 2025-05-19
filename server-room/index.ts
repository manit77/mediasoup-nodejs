import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { RoomServer, RoomServerConfig } from './roomServer/roomServer';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketServer } from './servers/roomPeerSocketServer';
import { defaultHTTPServerSecurityMap, RoomHTTPServer } from './servers/roomHttpServer';
import { getENV } from './utils/env';

let config: RoomServerConfig = getENV() as any;

for (let key in config) {
  console.log(`${key} : ${config[key]}`);
}
const app = express()
app.use(cors());

const certInfo = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};

const server = https.createServer(certInfo, app);
app.use(cors());
app.use(express.static('client-room'));
app.use(express.json({ limit: '1mb' }));

server.listen(config.room_server_port, async () => {

  console.log(`Server running at https://0.0.0.0:${config.room_server_port}`);

  //manager for media soup room server
  let roomServer = new RoomServer(config);
  roomServer.initMediaSoup().then(() => {
    

    let socketServerSecurityMap = defaultPeerSocketServerSecurityMap; //override with your security map
    let socketServer = new RoomPeerSocketServer(config, socketServerSecurityMap, server, roomServer);

    let httpServerSecurityMap = defaultHTTPServerSecurityMap; //override with your security map
    let httpServer = new RoomHTTPServer(config, httpServerSecurityMap, app, roomServer);

  });

});







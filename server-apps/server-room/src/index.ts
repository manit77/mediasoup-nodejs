import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { RoomServer, RoomServerConfig } from './roomServer/roomServer.js';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketServer } from './servers/roomPeerSocketServer.js';
import { defaultHTTPServerSecurityMap, RoomHTTPServer } from './servers/roomHttpServer.js';
import { getENV } from './utils/env.js';
import { WebSocketServer } from 'ws';

(async () => {

  let config: RoomServerConfig = await getENV() as any;

  for (let key in config) {
    console.log(`${key} : ${(config as any)[key]}`);
  }
  const app = express()
  app.use(cors());

  const certInfo = {
    key: fs.readFileSync(config.cert_key_path),
    cert: fs.readFileSync(config.cert_file_path),
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
      let socketServer = new RoomPeerSocketServer(config, socketServerSecurityMap, roomServer);
      socketServer.initWebSocket(new WebSocketServer({ server: server }));

      let httpServerSecurityMap = defaultHTTPServerSecurityMap; //override with your security map
      let httpServer = new RoomHTTPServer(config, httpServerSecurityMap, roomServer);
      httpServer.initHTTPServer(app);

    });

  });


})();









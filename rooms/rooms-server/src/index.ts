import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { RoomServer } from './roomServer/roomServer.js';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketServer } from './servers/roomPeerSocketServer.js';
import { defaultHTTPServerSecurityMap, RoomHTTPServer } from './servers/roomHttpServer.js';
import { getENV } from './utils/env.js';
import { WebSocketServer } from 'ws';
import { consoleInfo, consoleWarn } from './utils/utils.js';
import { TestObject } from "@rooms/rooms-models";
import { RoomServerConfig } from './roomServer/models.js';

(async () => {

  let testobject = new TestObject();
  testobject.hello();

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

  server.listen(config.room_server_port, config.room_server_ip, async () => {

    consoleInfo(`Server running at https://${config.room_server_ip}:${config.room_server_port}`);
    consoleInfo(`Public IP ${config.room_public_ip}, udp ports:${config.room_rtc_start_port}-${config.room_rtc_end_port}`);

    //manager for media soup room server
    let roomServer = new RoomServer(config);
    roomServer.init().then(() => {

      let socketServerSecurityMap = defaultPeerSocketServerSecurityMap; //override with your security map
      let socketServer = new RoomPeerSocketServer(config, socketServerSecurityMap, roomServer);
      socketServer.init(new WebSocketServer({ server: server }));

      let httpServerSecurityMap = defaultHTTPServerSecurityMap; //override with your security map
      let httpServer = new RoomHTTPServer(config, httpServerSecurityMap, roomServer);
      httpServer.init(app);

    });

  });

})();









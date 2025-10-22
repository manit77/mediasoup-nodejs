import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import cors from 'cors';
import { RoomServer } from './roomServer/roomServer.js';
import { defaultPeerSocketServerSecurityMap, RoomPeerSocketServer, RoomPeerSocketStore } from './servers/roomPeerSocketServer.js';
import { defaultHTTPServerSecurityMap, RoomAPIServer, } from './servers/RoomAPIServer.js';
import { getENV } from './utils/env.js';
import { WebSocketServer } from 'ws';
import { consoleError, consoleInfo } from './utils/utils.js';
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
  app.use(express.static('client-room'));
  app.use(express.json({ limit: '1mb' }));


  const certInfo = {
    key: fs.readFileSync(config.cert_key_path),
    cert: fs.readFileSync(config.cert_file_path),
  };

  //manager for media soup room server
  let roomServer = new RoomServer(config);
  roomServer.init().then(() => {

    let socketStore = new RoomPeerSocketStore();
    let httpServerSecurityMap = defaultHTTPServerSecurityMap; //override with your security map
    let socketServerSecurityMap = defaultPeerSocketServerSecurityMap; //override with your security map

    if (config.room_server_https_port) {
      const httpsServer = https.createServer(certInfo, app);
      httpsServer.listen(config.room_server_https_port, config.room_server_ip, async () => {
        consoleInfo(`HTTPS: https://${config.room_server_ip}:${config.room_server_https_port}`);
        consoleInfo(`Public IP ${config.room_public_ip ? config.room_public_ip : "not configured"}`);
        consoleInfo(`udp ports:${config.room_rtc_start_port}-${config.room_rtc_end_port}`);

        let socketServerHttps = new RoomPeerSocketServer(config, socketServerSecurityMap, roomServer, socketStore);
        socketServerHttps.init(new WebSocketServer({ server: httpsServer }));

      });
    } else if (config.room_server_http_port) {
      let httpServer = http.createServer(app);
      httpServer.listen(config.room_server_http_port, config.room_server_ip, () => {
        consoleInfo(`HTTP: http://${config.room_server_ip}:${config.room_server_http_port}`);

        let socketServerHttp = new RoomPeerSocketServer(config, socketServerSecurityMap, roomServer, socketStore);
        socketServerHttp.init(new WebSocketServer({ server: httpServer }));
      });
    } else {
      consoleError("no HTTP ports configured");
    }
    
    let roomAPIServer = new RoomAPIServer(config, httpServerSecurityMap, roomServer);
    roomAPIServer.init(app);
    
  });


})();









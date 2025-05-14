import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { Peer, Room } from './room';
import { ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, payloadTypeClient, payloadTypeServer, ProducedMsg, ProducerTransportCreatedMsg, RegisterResultMsg, RoomJoinResultMsg, RoomNewPeerMsg, RoomNewProducerMsg } from './roomSharedModels';
import { randomUUID } from 'crypto';
import { stopRecording } from './recorder';
import { RoomServer } from './roomServer';
import { RoomSocketServer } from './roomSocketServer';
import { RoomHTTPServer } from './roomHttpServer';


let config = {
  serverPort: 3000
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


server.listen(config.serverPort, async () => {
  console.log(`Server running at https://0.0.0.0:${config.serverPort}`);

  //manager for media soup room server
  let roomServer = new RoomServer();
  let socketServer = new RoomSocketServer(server, roomServer);  
  let httpServer = new RoomHTTPServer(app, roomServer);

});







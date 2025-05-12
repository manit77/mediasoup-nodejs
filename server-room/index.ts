import express from 'express';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import * as mediasoup from 'mediasoup';
import fs from 'fs';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import { Peer, Room } from './room';
import { ConsumedMsg, ConsumeMsg, ConsumerTransportCreatedMsg, payloadTypeClient, payloadTypeServer, ProducedMsg, ProducerTransportCreatedMsg, RegisterResultMsg, RoomJoinResultMsg, RoomNewPeerMsg, RoomNewProducerMsg } from './sharedModels';
import { randomUUID } from 'crypto';
import { stopRecording } from './recorder';
import { RoomServer } from './server';


const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};

const server = https.createServer(certInfo, app);
app.use(express.static('client-room'));

let roomServer = new RoomServer(server);

roomServer.start();





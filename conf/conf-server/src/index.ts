import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer, ConferenceServerConfig } from './confServer/conferenceServer.js';
import { getENV } from './utils/env.js';

let config: ConferenceServerConfig = await getENV() as any;

const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync(config.cert_key_path),
  cert: fs.readFileSync(config.cert_file_path),
};

const server = https.createServer(certInfo, app);
// app.use(express.static('client-webrtc'));
let conferenceServer = new ConferenceServer(config, app, server);
conferenceServer.start();

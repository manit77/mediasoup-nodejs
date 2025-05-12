import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer } from './conferenceServer';

const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};

const server = https.createServer(certInfo, app);
app.use(express.static('client-webrtc'));

let conferenceServer = new ConferenceServer(server);

conferenceServer.start();

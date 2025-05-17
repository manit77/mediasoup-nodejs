import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer';

let config: ConferenceServerConfig = {
    conf_server_port: 3001,
    conf_reconnection_timeout: 30000,
    conf_secret_key: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1",
    conf_max_peers_per_conf: 2,
    conf_token_expires_min: 60,
    room_access_token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjowLCJpYXQiOjE3NDc0OTU4NjZ9.cCqKeByvZ2EujLG3bUWBHjYDSJ9qTOWWMBuGYaGE6wQ",
    room_api_url: "https://localhost:3000",
}

const app = express();
app.use(cors());

const certInfo = {
  key: fs.readFileSync('./certs/server.key'),
  cert: fs.readFileSync('./certs/server.crt'),
};

const server = https.createServer(certInfo, app);
app.use(express.static('client-webrtc'));

let conferenceServer = new ConferenceServer(config, server);

conferenceServer.start();

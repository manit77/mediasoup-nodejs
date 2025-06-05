import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer } from './confServer/conferenceServer.js';
import { getENV } from './utils/env.js';
let config = await getENV();
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
//# sourceMappingURL=index.js.map
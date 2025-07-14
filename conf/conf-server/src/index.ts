import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer, ConferenceServerConfig } from './confServer/conferenceServer.js';
import { getENV } from './utils/env.js';
import { ConferenceAPI } from './confServer/conferenceAPI.js';
import { AuthUtils } from './confServer/authUtils.js';
import chalk from 'chalk';

const config: ConferenceServerConfig = await getENV() as any;

const app = express();
app.use(cors());
  app.use(express.json({ limit: '1mb' }));

const certInfo = {
  key: fs.readFileSync(config.cert_key_path),
  cert: fs.readFileSync(config.cert_file_path),
};

const server = https.createServer(certInfo, app);

server.listen(config.conf_server_port, async () => {
  console.log(chalk.bgGreen(`Server running at https://0.0.0.0:${config.conf_server_port}`));

  let conferenceServer = new ConferenceServer(config, app, server);
  conferenceServer.start();

  let apiServer = new ConferenceAPI(app, config, conferenceServer);
  apiServer.start();

});



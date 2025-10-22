import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { ConferenceServer } from './confServer/conferenceServer.js';
import { getENV } from './utils/env.js';
import { ConferenceAPI } from './confServer/conferenceAPI.js';
import chalk from 'chalk';
import { ConferenceSocketServer } from './confServer/conferenceSocketServer.js';
import { TestObject } from '@conf/conf-models';
import { ConferenceServerConfig } from './confServer/models.js';

let testobject = new TestObject();
testobject.hello();

const config: ConferenceServerConfig = await getENV() as any;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const certInfo = {
  key: fs.readFileSync(config.cert_key_path),
  cert: fs.readFileSync(config.cert_file_path),
};

const httpsServer = https.createServer(certInfo, app);

httpsServer.listen(config.conf_server_port, async () => {
  console.log(chalk.bgGreen(`Server running at https://0.0.0.0:${config.conf_server_port}`));

  let conferenceServer = new ConferenceServer({ config });

  let apiServer = new ConferenceAPI({ app, config, confServer: conferenceServer });
  apiServer.start();

  let socketServer = new ConferenceSocketServer({ httpServer: httpsServer, config, confServer: conferenceServer });
  socketServer.start();

});



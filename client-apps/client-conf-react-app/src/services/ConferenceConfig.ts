import { ConferenceClientConfig } from "@conf/conf-client/src/models";

let config  = new ConferenceClientConfig();
config.conf_server_url = "https://localhost:3100";
config.conf_ws_url = "https://localhost:3100";
config.socket_enable_logs = false;

export const conferenceClientConfig = config;


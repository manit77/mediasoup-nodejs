import { AppConfig } from "./models";
import * as file from 'fs';
import * as path from 'path';

export function loadConfig() : AppConfig {
  let config: AppConfig = null;

  try {
    const configPath = path.join(__dirname, 'config.json');  
    if (file.existsSync(configPath)) {
      config = require(configPath) as AppConfig;      
    }  
  } catch (error) {
    console.error('Could not load config.json. Falling back to default.', error);
  }

  if (!config) {
    config = {
      startUrl: process.env['KIOSK_START_URL'] ?? "",
      enableJSConsole: undefined
    };
  }

  // Env override for enabling DevTools via F12
  const envFlag = process.env['KIOSK_ENABLE_JSCONSOLE'];
  if (envFlag !== undefined) {
    const lowered = envFlag.toLowerCase();
    config.enableJSConsole = lowered === '1' || lowered === 'true' || lowered === 'yes';
  } else if (typeof config.enableJSConsole === 'undefined') {
    config.enableJSConsole = false;
  }

  return config;
}

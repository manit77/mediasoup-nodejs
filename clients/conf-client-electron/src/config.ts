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
      startUrl: process.env['CONFCLIENT_START_URL'] ?? "",
      enableJSConsole: undefined
    };
  }

  // Env override: isKiosk (default false)
  const isKioskEnv = process.env['CONFCLIENT_IS_KIOSK'];
  if (isKioskEnv !== undefined) {
    const lowered = isKioskEnv.toLowerCase();
    config.isKiosk = lowered === '1' || lowered === 'true' || lowered === 'yes';
  } else if (typeof config.isKiosk === 'undefined') {
    config.isKiosk = false;
  }

  // Env override: enableKeyboard (default false)
  const enableKeyboardEnv = process.env['CONFCLIENT_ENABLE_KEYBOARD'];
  if (enableKeyboardEnv !== undefined) {
    const lowered = enableKeyboardEnv.toLowerCase();
    config.enableKeyboard = lowered === '1' || lowered === 'true' || lowered === 'yes';
  } else if (typeof config.enableKeyboard === 'undefined') {
    config.enableKeyboard = false;
  }

  // Env override for enabling DevTools via F12
  const envFlag = process.env['CONFCLIENT_ENABLE_JSCONSOLE'];
  if (envFlag !== undefined) {
    const lowered = envFlag.toLowerCase();
    config.enableJSConsole = lowered === '1' || lowered === 'true' || lowered === 'yes';
  } else if (typeof config.enableJSConsole === 'undefined') {
    config.enableJSConsole = false;
  }

  return config;
}

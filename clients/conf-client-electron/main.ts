import { app, BrowserWindow, session, systemPreferences, Certificate, Event, WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { desktopCapturer } from 'electron';

// --- Configuration ---

// Define an interface for our configuration structure
interface AppConfig {
  startUrl: string;
}

let startUrl: string = "";

try {
  // Use `resolveJsonModule` in tsconfig to allow direct import
  const config: AppConfig = require('../config.json');
  startUrl = config.startUrl;
} catch (error) {
  console.error('Could not load config.json. Falling back to default.', error);
}

// Use environment variable, then config file, then a hardcoded default.
startUrl = process.env.ELECTRON_START_URL || startUrl || 'https://192.168.40.43:3000/login';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true
    },
  });

  // Load the initial URL
  mainWindow.loadURL(startUrl);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Add a handler to toggle DevTools with F12
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key.toLowerCase() === 'f12' && input.type === 'keyDown') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    // Check screen recording status
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    console.log(`Screen access status: ${screenStatus}`);

    // Standard media access
    await systemPreferences.askForMediaAccess('camera');
    await systemPreferences.askForMediaAccess('microphone');
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const ourUrl = new URL(startUrl);

    // Ensure 'display-capture' is allowed
    const allowedPermissions = ['media', 'camera', 'microphone', 'display-capture'];

    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // For a quick test, we'll just automatically pick the first available screen.
      // In a real app, you'd send these sources to your frontend to let the user pick.
      callback({ video: sources[0] });
    });
  });

  createWindow();
});

app.on('certificate-error', (event: Event, webContents: WebContents, url: string, error: string, certificate: Certificate, callback: (isTrusted: boolean) => void) => {
  // WARNING: This is insecure and will bypass all SSL certificate validation.
  // Only use for specific testing scenarios.
  console.warn(`Ignoring certificate error for ${url}`);
  event.preventDefault();
  callback(true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
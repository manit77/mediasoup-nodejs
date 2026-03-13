import { app, BrowserWindow, session, systemPreferences, Certificate, Event, WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

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
      // It's recommended to use a preload script for security,
      // but for loading a remote URL, it's not strictly necessary
      // unless you want to expose Node.js APIs to the renderer.
      // preload: path.join(__dirname, 'preload.js')
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
  // On macOS, we need to explicitly ask for camera and microphone permissions.
  if (process.platform === 'darwin') {
    try {
      const cameraAccess = await systemPreferences.askForMediaAccess('camera');
      console.log(`Camera access: ${cameraAccess}`);
      const micAccess = await systemPreferences.askForMediaAccess('microphone');
      console.log(`Microphone access: ${micAccess}`);
    } catch (error) {
      console.error('Could not get media access', error);
    }
  }

  // Handle permission requests for media (camera, microphone)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const ourUrl = new URL(startUrl);
    const requestUrl = new URL(webContents.getURL());

    const allowedPermissions: string[] = ['media', 'camera', 'microphone'];

    if (allowedPermissions.includes(permission) && requestUrl.origin === ourUrl.origin) {
      callback(true); // Grant permission
    } else {
      callback(false); // Deny other requests
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
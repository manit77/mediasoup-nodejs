import { app, BrowserWindow, ipcMain, systemPreferences, session, BrowserView, Certificate, Event, WebContents, desktopCapturer } from 'electron';
import * as path from 'path';
import { KEYBOARD_HEIGHT, KEYBOARD_TOOLBAR_HEIGHT } from './keyboardLayout';
import {  AppConfig, ipcCommands } from './models';
import * as file from 'fs';
import { loadConfig } from './config';

let config: AppConfig = loadConfig();
if (!config.startUrl) {
  config.startUrl = 'error_noconfig.html';
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every minute
let isKeyboardVisible = false;
let keyboardEnabled = true;
let mainWindow: BrowserWindow | null = null;
let remoteView: BrowserView | null = null;
let keyboardView: BrowserView | null = null;
let lastActivityTime = Date.now();
let idleCheckInterval: NodeJS.Timeout | null = null;

function loadStartTarget(): void {
  if (!remoteView) return;
  const target = config.startUrl;

  // Treat http/https as remote URLs, everything else as a local file path
  if (/^https?:\/\//i.test(target)) {
    remoteView.webContents.loadURL(target);
  } else {
    const filePath = path.isAbsolute(target)
      ? target
      : path.join(__dirname, target);
    remoteView.webContents.loadFile(filePath);
  }
}

function resetIdleTimer(): void {
  lastActivityTime = Date.now();
}

function startIdleCheck(): void {
  if (idleCheckInterval) return;
  idleCheckInterval = setInterval(() => {
    if (Date.now() - lastActivityTime >= IDLE_TIMEOUT_MS) {
      loadStartTarget();
      resetIdleTimer();
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

function updateLayout(showKeyboard: boolean) {
  if (!mainWindow || !remoteView || !keyboardView) {
    return;
  }

  const [width, height] = mainWindow.getContentSize();
  isKeyboardVisible = showKeyboard;

  if (showKeyboard) {
    // Remote app takes up the top part
    remoteView.setBounds({ x: 0, y: 0, width, height: height - KEYBOARD_HEIGHT });
    // Keyboard (toolbar + keys) takes up the bottom part
    keyboardView.setBounds({ x: 0, y: height - KEYBOARD_HEIGHT, width, height: KEYBOARD_HEIGHT });
  } else {
    // Remote app takes up all but the toolbar area
    remoteView.setBounds({ x: 0, y: 0, width, height: height - KEYBOARD_TOOLBAR_HEIGHT });
    // Only toolbar is visible at the bottom
    keyboardView.setBounds({ x: 0, y: height - KEYBOARD_TOOLBAR_HEIGHT, width, height: KEYBOARD_TOOLBAR_HEIGHT });
  }

  // Inform the keyboard view so it can toggle its internal panel + button text
  keyboardView.webContents.send('keyboard-visibility', showKeyboard);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // --- Remote App View ---
  remoteView = new BrowserView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.addBrowserView(remoteView);

  // Show custom error page when the site cannot be reached (main frame only)
  remoteView.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    // -3 = ABORTED (e.g. user navigated away); show error for actual network failures
    if (errorCode === -3) return;
    const errorPath = path.join(__dirname, 'error.html');
    remoteView?.webContents.loadFile(errorPath);
  });

  loadStartTarget();
  //remoteView.webContents.openDevTools();

  // --- Keyboard View ---
  keyboardView = new BrowserView({
    webPreferences: {
      nodeIntegration: true, // Keyboard needs access to ipcRenderer
      contextIsolation: false,
      devTools: true,
    }
  });
  mainWindow.addBrowserView(keyboardView);
  // In the built app, __dirname points to dist, where keyboard.html is emitted
  const keyboardPath = path.join(__dirname, 'keyboard.html');
  keyboardView.webContents.loadFile(keyboardPath);
  //keyboardView.webContents.openDevTools();

  // --- Initial Layout ---
  updateLayout(false); // Initially show only toolbar (keyboard hidden)

  // --- Window Event Handlers ---
  mainWindow.on('resize', () => {
    if (mainWindow) {
      // Maintain current keyboard visibility state on resize
      updateLayout(isKeyboardVisible);
    }
  });

  const onBeforeInput = (event: Electron.Event, input: Electron.Input) => {
    resetIdleTimer();
    // Only allow F12 DevTools toggle when explicitly enabled in config/env
    if (!config.enableJSConsole) {
      return;
    }
    if (input.key.toLowerCase() === 'f12' && input.type === 'keyDown') {
      event.preventDefault();
      remoteView?.webContents.toggleDevTools();
      keyboardView?.webContents.toggleDevTools();
    }
  };
  remoteView.webContents.on('before-input-event', onBeforeInput);
  keyboardView.webContents.on('before-input-event', onBeforeInput);

  ipcMain.on(ipcCommands.userActivity, resetIdleTimer);

  startIdleCheck();

  ipcMain.on('go-home', () => {
    loadStartTarget();
  });

  // --- IPC Handlers from Views ---

  ipcMain.on(ipcCommands.showKeyboard, () => {
    console.log('IPC: show-keyboard');
    if (keyboardEnabled) {
      updateLayout(true);
    }
  });

  ipcMain.on(ipcCommands.hideKeyboard, () => {    
    console.log('IPC: hide-keyboard');
    updateLayout(false);
  });

  ipcMain.on(ipcCommands.disableKeyboard, () => {
    console.log('IPC: disable-keyboard');
    keyboardEnabled = false;
    updateLayout(false);
    keyboardView?.webContents.send('keyboard-enabled', false);
  });

  ipcMain.on(ipcCommands.enableKeyboard, () => {
    console.log('IPC: enable-keyboard');
    keyboardEnabled = true;
    keyboardView?.webContents.send('keyboard-enabled', true);
  });

  ipcMain.on(ipcCommands.keyPress, (_event, key) => {
    if (remoteView && remoteView.webContents) {
      console.log(`Forwarding key: ${key}`);
      remoteView.webContents.focus();

      if (key === 'Enter') {
        remoteView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
        remoteView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      } else if (key === 'Backspace') {
        remoteView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
        remoteView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
      } else if (key === 'Tab') {
        remoteView.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
        remoteView.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
      } else {
        remoteView.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        remoteView.webContents.sendInputEvent({ type: 'char', keyCode: key });
        remoteView.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
      }
    }
  });
}

// Instruct Chromium to ignore certificate errors globally (including localhost)
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// --- App Lifecycle ---

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    const cameraPrivilege = await systemPreferences.askForMediaAccess('camera');
    const micPrivilege = await systemPreferences.askForMediaAccess('microphone');

    if (!cameraPrivilege || !micPrivilege) {
      console.error("User denied camera or mic access");
    }
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'camera', 'microphone', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle getDisplayMedia() so screen share works in the remote app (BrowserView)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      });
      const screenSource = sources.find((s) => s.id.startsWith('screen:'));
      const source = screenSource ?? sources[0];
      if (source) {
        callback({ video: source });
      } else {
        callback({});
      }
    } catch (err) {
      console.error('setDisplayMediaRequestHandler error:', err);
      callback({});
    }
  });

  // Trust all certificates at the session level (disables SSL verification)
  session.defaultSession.setCertificateVerifyProc((_request, callback) => {
    callback(0); // 0 = OK
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; connect-src * ws: wss:;"
        ],
      }
    });
  });

  createWindow();
});

app.on('certificate-error', (event: Event, webContents: WebContents, url: string, error: string, certificate: Certificate, callback: (isTrusted: boolean) => void) => {
  console.warn(`Ignoring certificate error for ${url}`);
  event.preventDefault();
  callback(true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
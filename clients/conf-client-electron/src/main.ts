import { app, BrowserWindow, ipcMain, systemPreferences, session, WebContentsView, Certificate, Event, WebContents, desktopCapturer } from 'electron';
import * as path from 'path';
import { KEYBOARD_HEIGHT, KEYBOARD_TOOLBAR_HEIGHT } from './keyboardLayout';
import {  AppConfig, ipcCommands } from './models';
import * as file from 'fs';
import { loadConfig } from './config';

let config: AppConfig = loadConfig();
if (!config.startUrl) {
  config.startUrl = 'error_noconfig.html';
}

function getIdleTimeoutMs(): number {
  const minutes = typeof config.idleTimeoutMinutes === 'number' && config.idleTimeoutMinutes > 0
    ? config.idleTimeoutMinutes
    : 30;
  return minutes * 60 * 1000;
}

const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // check every minute
let isKeyboardVisible = false;
let keyboardEnabled = config.enableKeyboard ?? false;
let mainWindow: BrowserWindow | null = null;
let remoteView: WebContentsView | null = null;
let keyboardView: WebContentsView | null = null;
let lastActivityTime = Date.now();
let idleCheckInterval: NodeJS.Timeout | null = null;

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // If we didn't get the lock, another instance is already running. Quit immediately.
  console.log('Another instance is already running. Quitting...');
  app.quit();
} else {
  // We have the lock. Listen for anyone else trying to open a second instance.
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance; focus our existing window instead.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

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
  if (idleCheckInterval) 
    clearInterval(idleCheckInterval);

  idleCheckInterval = setInterval(() => {
    const timeoutMs = getIdleTimeoutMs();
    if (Date.now() - lastActivityTime >= timeoutMs) {
      loadStartTarget();
      resetIdleTimer();
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

function updateLayout(showKeyboard: boolean) {
  if (!mainWindow || !remoteView) {
    return;
  }

  const [width, height] = mainWindow.getContentSize();

  // When keyboard is disabled, remote view uses full window
  if (!keyboardView) {
    remoteView.setBounds({ x: 0, y: 0, width, height });
    return;
  }

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

  bringKeyboardToFront();

  // Inform the keyboard view so it can toggle its internal panel + button text
  keyboardView.webContents.send('keyboard-visibility', showKeyboard);
}

function bringKeyboardToFront() {
  if (mainWindow && keyboardView) {
    // Re-adding the same view will reorder it to the top.
    mainWindow.contentView.addChildView(keyboardView);
  }
}

/** Returns 'granted' or a non-granted status for camera/mic (for toolbar indicators). */
function getMediaStatus(): { camera: string; microphone: string } {
  try {
    const camera = systemPreferences.getMediaAccessStatus('camera');
    const microphone = systemPreferences.getMediaAccessStatus('microphone');
    return { camera: camera ?? 'not-determined', microphone: microphone ?? 'not-determined' };
  } catch {
    return { camera: 'not-determined', microphone: 'not-determined' };
  }
}

function createWindow(): void {
  const isKiosk = config.isKiosk ?? false;
  mainWindow = new BrowserWindow({
    fullscreen: isKiosk,
    kiosk: isKiosk,
    alwaysOnTop: isKiosk,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (isKiosk) {
      mainWindow?.webContents.insertCSS('html, body { cursor: none; }');
    }
  });

  // --- Remote App View ---
  remoteView = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      devTools: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.contentView.addChildView(remoteView);

  // Show custom error page when the site cannot be reached (main frame only)
  remoteView.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    // -3 = ABORTED (e.g. user navigated away); show error for actual network failures
    if (errorCode === -3) return;
    const errorPath = path.join(__dirname, 'error.html');
    remoteView?.webContents.loadFile(errorPath);
  });

  remoteView.webContents.on('render-process-gone', (event, details) => {
    console.error(`Remote view crashed! Reason: ${details.reason}. Recovering in 1s...`);
    setTimeout(() => {
      loadStartTarget(); 
    }, 1000);
  });

  loadStartTarget();
  //remoteView.webContents.openDevTools();

  // --- Keyboard View (only when enableKeyboard is true) ---
  if (keyboardEnabled) {
    keyboardView = new WebContentsView({
      webPreferences: {
        nodeIntegration: true, // Keyboard needs access to ipcRenderer
        contextIsolation: false,
        devTools: true,
      }
    });
    mainWindow.contentView.addChildView(keyboardView);
    // In the built app, __dirname points to dist, where keyboard.html is emitted
    const keyboardPath = path.join(__dirname, 'keyboard.html');
    
    keyboardView.webContents.on('render-process-gone', (event, details) => {
      console.error(`Keyboard view crashed! Reason: ${details.reason}. Recovering in 1s...`);
      setTimeout(() => {
        keyboardView?.webContents.reload();
      }, 1000);
    });
    
    keyboardView.webContents.once('did-finish-load', () => {
      keyboardView?.webContents.send('keyboard-enabled', keyboardEnabled);
      const media = getMediaStatus();
      keyboardView?.webContents.send('media-status', media);
    });

    keyboardView.webContents.on('did-finish-load', () => {
      keyboardView?.webContents.send('keyboard-enabled', keyboardEnabled);
      const media = getMediaStatus();
      keyboardView?.webContents.send('media-status', media);
    });

    keyboardView.webContents.loadFile(keyboardPath);    

  }

  // --- Initial Layout ---
  updateLayout(false); // Full remote view, or toolbar only if keyboard enabled

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
  if (keyboardView) {
    keyboardView.webContents.on('before-input-event', onBeforeInput);
  }

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
      // Re-report focused input so we can scroll it into view after keyboard is shown
      remoteView?.webContents.executeJavaScript(
        'window.electron && typeof window.electron.reportFocusedInput === "function" && window.electron.reportFocusedInput();'
      ).catch(() => {});
    }
  });

  ipcMain.on(ipcCommands.inputFocused, () => {
    if (!remoteView || !isKeyboardVisible) return;
    // After resize, scroll the focused input into view (center) so it isn't covered by the keyboard
    setTimeout(() => {
      remoteView?.webContents.executeJavaScript(`
        if (document.activeElement) {
          document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      `).catch(() => {});
    }, 100);
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

  ipcMain.on(ipcCommands.reloadConfig, () => {
    console.log('IPC: reload-config');
    // Reload configuration from disk/env and go back to the new startUrl
    config = loadConfig();
    if (!config.startUrl) {
      config.startUrl = 'error_noconfig.html';
    }
    keyboardEnabled = config.enableKeyboard ?? false;
    keyboardView?.webContents.send('keyboard-enabled', keyboardEnabled);
    loadStartTarget();
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
import { ipcRenderer } from 'electron';
import Keyboard from 'simple-keyboard';
import { layouts, supportedLanguages } from './keyboardLayout';
import { ipcCommands } from './models';

document.addEventListener('DOMContentLoaded', () => {
  // Start with keyboard hidden; toolbar button should say "Show keyboard"
  let isVisible = false;

  // Track current layout (default/shift) for simple-keyboard
  let layoutName: 'default' | 'shift' = 'default';
  let keyboardEnabled = true;

  const keyboard = new Keyboard({
    layout: layouts.en,
    layoutName,
    display: {
      '{enter}': 'enter',
      '{bksp}': 'backspace',
      '{space}': 'space',
      '{shift}': 'shift',
      '{shiftleft}': 'shift',
      '{shiftright}': 'shift',
      '{tab}': 'tab',
    },
    onKeyPress: (button: string) => {
      // Handle layout toggle keys locally
      if (button === '{shift}' || button === '{shiftleft}' || button === '{shiftright}') {
        layoutName = layoutName === 'default' ? 'shift' : 'default';
        keyboard.setOptions({ layoutName });
        return;
      }

      // Map simple-keyboard buttons to the keys our main process expects
      switch (button) {
        case '{enter}':
          ipcRenderer.send(ipcCommands.keyPress, 'Enter');
          break;
        case '{bksp}':
          ipcRenderer.send(ipcCommands.keyPress, 'Backspace');
          break;
        case '{space}':
          ipcRenderer.send(ipcCommands.keyPress, ' ');
          break;
        case '{tab}':
          ipcRenderer.send(ipcCommands.keyPress, 'Tab');
          break;
        default:
          // Regular character keys
          ipcRenderer.send(ipcCommands.keyPress, button);
          break;
      }
    },
  });

  // Report user activity for idle timeout (clicks/touches on keyboard view)
  document.addEventListener('click', () => ipcRenderer.send(ipcCommands.userActivity));
  document.addEventListener('touchstart', () => ipcRenderer.send(ipcCommands.userActivity));

  // Toolbar buttons
  const homeBtn = document.getElementById('btn-home');
  const toggleBtn = document.getElementById('btn-toggle-keyboard') as HTMLButtonElement | null;
  const toggleLabel = document.getElementById('btn-toggle-keyboard-label') as HTMLSpanElement | null;
  const keyboardContainer = document.getElementById('keyboard-container') as HTMLDivElement | null;
  const languageBtn = document.getElementById('btn-language');
  const languagePopup = document.getElementById('language-popup');
  const languagePopupClose = document.getElementById('language-popup-close');
  const languageList = document.getElementById('language-list');

  // Ensure initial UI matches hidden state before first IPC arrives
  if (keyboardContainer) {
    keyboardContainer.style.display = 'none';
  }
  if (toggleLabel) {
    toggleLabel.textContent = 'Show keyboard';
  }

  // Build language list from supportedLanguages
  const languageOptions: HTMLButtonElement[] = [];
  if (languageList) {
    supportedLanguages.forEach((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lang-option ${lang.className}`;
      btn.setAttribute('data-lang', lang.code);
      btn.textContent = lang.label;
      languageList.appendChild(btn);
      languageOptions.push(btn);
    });
  }

  homeBtn?.addEventListener('click', () => {
    ipcRenderer.send(ipcCommands.goHome);
  });

  toggleBtn?.addEventListener('click', () => {
    // Toggle keyboard visibility via main process
    if (isVisible) {
      ipcRenderer.send(ipcCommands.hideKeyboard);
    } else {
      ipcRenderer.send(ipcCommands.showKeyboard);
    }
  });

  languageBtn?.addEventListener('click', () => {
    // When keyboard is disabled, language changes should be blocked
    if (!keyboardEnabled) {
      return;
    }
    // Ensure keyboard is shown when changing language
    ipcRenderer.send(ipcCommands.showKeyboard);
    languagePopup?.classList.add('visible');
  });

  languagePopupClose?.addEventListener('click', () => {
    languagePopup?.classList.remove('visible');
  });

  languageOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang) {
        const layout = layouts[lang] || layouts.en;
        layoutName = 'default';
        keyboard.setOptions({ layout, layoutName });
        console.log(`Selected keyboard language: ${lang}`);
        // Optionally, update button label to chosen language
      }
      languagePopup?.classList.remove('visible');
    });
  });

  // React to visibility changes from the main process to update UI
  ipcRenderer.on('keyboard-visibility', (_event, visible: boolean) => {
    isVisible = visible;
    if (keyboardContainer) {
      keyboardContainer.style.display = visible ? 'block' : 'none';
    }
    if (toggleLabel) {
      toggleLabel.textContent = visible ? 'Hide keyboard' : 'Show keyboard';
    }
  });

  // Track enabled/disabled state pushed from main
  ipcRenderer.on('keyboard-enabled', (_event, enabled: boolean) => {
    keyboardEnabled = enabled;
  });

  // Camera/mic: permission from main process + physical device presence via checkHardware()
  let lastMediaStatus: { camera: string; microphone: string } | null = null;
  let hasCameraDevice = false;
  let hasMicDevice = false;

  async function checkHardware(): Promise<{ hasCamera: boolean; hasMic: boolean }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some((device) => device.kind === 'videoinput');
    const hasMic = devices.some((device) => device.kind === 'audioinput');
    console.log(`Camera connected: ${hasCamera}`);
    console.log(`Mic connected: ${hasMic}`);
    return { hasCamera, hasMic };
  }

  function updateMediaIcons() {
    const iconCamera = document.getElementById('icon-camera');
    const iconMic = document.getElementById('icon-mic');
    if (!lastMediaStatus) return;

    const cameraGranted = lastMediaStatus.camera === 'granted' && hasCameraDevice;
    const micGranted = lastMediaStatus.microphone === 'granted' && hasMicDevice;

    if (iconCamera) {
      iconCamera.className = `material-icons media-icon ${cameraGranted ? 'granted' : 'denied'}`;
      const cameraTitle = !hasCameraDevice
        ? 'Camera: no device found'
        : lastMediaStatus.camera === 'granted'
          ? 'Camera: accessible'
          : 'Camera: not accessible';
      iconCamera.setAttribute('title', cameraTitle);
    }
    if (iconMic) {
      iconMic.className = `material-icons media-icon ${micGranted ? 'granted' : 'denied'}`;
      const micTitle = !hasMicDevice
        ? 'Microphone: no device found'
        : lastMediaStatus.microphone === 'granted'
          ? 'Microphone: accessible'
          : 'Microphone: not accessible';
      iconMic.setAttribute('title', micTitle);
    }
  }

  ipcRenderer.on('media-status', (_event, status: { camera: string; microphone: string }) => {
    lastMediaStatus = status;
    updateMediaIcons();
  });

  // Initial hardware check and device-change listener
  if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
    checkHardware().then((status) => {
      hasCameraDevice = status.hasCamera;
      hasMicDevice = status.hasMic;
      updateMediaIcons();
    }).catch(() => {
      updateMediaIcons();
    });

    navigator.mediaDevices.ondevicechange = async () => {
      console.log('Hardware change detected!');
      const status = await checkHardware();
      hasCameraDevice = status.hasCamera;
      hasMicDevice = status.hasMic;
      updateMediaIcons();
    };
  } else {
    updateMediaIcons();
  }
});
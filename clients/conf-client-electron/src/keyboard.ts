import { ipcRenderer } from 'electron';
import Keyboard from 'simple-keyboard';
import { layouts, supportedLanguages } from './keyboardLayout';

document.addEventListener('DOMContentLoaded', () => {
  // Start with keyboard hidden; toolbar button should say "Show keyboard"
  let isVisible = false;

  // Track current layout (default/shift) for simple-keyboard
  let layoutName: 'default' | 'shift' = 'default';

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
          ipcRenderer.send('key-press', 'Enter');
          break;
        case '{bksp}':
          ipcRenderer.send('key-press', 'Backspace');
          break;
        case '{space}':
          ipcRenderer.send('key-press', ' ');
          break;
        case '{tab}':
          ipcRenderer.send('key-press', 'Tab');
          break;
        default:
          // Regular character keys
          ipcRenderer.send('key-press', button);
          break;
      }
    },
  });

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
    ipcRenderer.send('go-home');
  });

  toggleBtn?.addEventListener('click', () => {
    // Toggle keyboard visibility via main process
    if (isVisible) {
      ipcRenderer.send('hide-keyboard');
    } else {
      ipcRenderer.send('show-keyboard');
    }
  });

  languageBtn?.addEventListener('click', () => {
    // Ensure keyboard is shown when changing language
    ipcRenderer.send('show-keyboard');
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
});
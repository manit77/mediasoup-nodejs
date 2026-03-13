import { ipcRenderer } from 'electron';
import Keyboard from 'simple-keyboard';

document.addEventListener('DOMContentLoaded', () => {
  let isVisible = false;
  const keyboard = new Keyboard({
    onKeyPress: (button: string) => {
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
import { ipcRenderer } from 'electron';
import { ipcCommands } from './models';

// Expose keyboard control and reload to the hosted web app
declare global {
  interface Window {
    electron?: {
      hideKeyboard: () => void;
      showKeyboard: () => void;
      disableKeyboard: () => void;
      enableKeyboard: () => void;
      goHome: () => void;
      reloadConfig: () => void;
      /** Report the currently focused input's rect so the main process can scroll it into view. */
      reportFocusedInput: () => void;
    };
  }
}

function sendFocusedInputRect(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  ipcRenderer.send(ipcCommands.inputFocused, { bottom: rect.bottom, height: rect.height });
}

window.electron = {
  hideKeyboard: () => ipcRenderer.send(ipcCommands.hideKeyboard),
  showKeyboard: () => ipcRenderer.send(ipcCommands.showKeyboard),
  disableKeyboard: () => ipcRenderer.send(ipcCommands.disableKeyboard),
  enableKeyboard: () => ipcRenderer.send(ipcCommands.enableKeyboard),
  goHome: () => ipcRenderer.send(ipcCommands.goHome),
  reloadConfig: () => ipcRenderer.send(ipcCommands.reloadConfig),
  reportFocusedInput: () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && FORM_CONTROL_TAGS.includes(el.tagName)) {
      sendFocusedInputRect(el);
    }
  },
};

function reportUserActivity() {
  ipcRenderer.send(ipcCommands.userActivity);
}
window.addEventListener('click', reportUserActivity);
window.addEventListener('touchstart', reportUserActivity);
window.addEventListener('mousedown', reportUserActivity);
window.addEventListener('keydown', reportUserActivity);

// Block copy/paste and context menu inside the hosted web app
window.addEventListener('copy', (event) => {
  event.preventDefault();
});
window.addEventListener('cut', (event) => {
  event.preventDefault();
});
window.addEventListener('paste', (event) => {
  event.preventDefault();
});
window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

// Block file uploads (input[type=file]) inside the hosted web app
window.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const input = target.closest('input[type=\"file\"]') as HTMLInputElement | null;
  if (input) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

/** Form controls that can receive focus when using TAB to navigate (show keyboard + scroll into view). */
const FORM_CONTROL_TAGS = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];

window.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement;
  if (target && FORM_CONTROL_TAGS.includes(target.tagName)) {
    console.log('Focus on form control detected, showing keyboard.');
    ipcRenderer.send(ipcCommands.showKeyboard);
    sendFocusedInputRect(target);
  }
});
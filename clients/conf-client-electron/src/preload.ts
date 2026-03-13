import { ipcRenderer } from 'electron';

// Expose keyboard control to the hosted web app (e.g. window.electronKeyboard.showKeyboard())
declare global {
  interface Window {
    electronKeyboard?: {
      hideKeyboard: () => void;
      showKeyboard: () => void;
      disableKeyboard: () => void;
      enableKeyboard: () => void;
    };
  }
}

window.electronKeyboard = {
  hideKeyboard: () => ipcRenderer.send('hide-keyboard'),
  showKeyboard: () => ipcRenderer.send('show-keyboard'),
  disableKeyboard: () => ipcRenderer.send('disable-keyboard'),
  enableKeyboard: () => ipcRenderer.send('enable-keyboard'),
};

const INPUT_TAGS = ['INPUT', 'TEXTAREA'];

window.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement;
  if (target && INPUT_TAGS.includes(target.tagName)) {
    console.log('Focus on input detected, showing keyboard.');
    ipcRenderer.send('show-keyboard');
  }
});
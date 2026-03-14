import { ipcRenderer } from 'electron';

// Expose keyboard control and reload to the hosted web app
declare global {
  interface Window {
    electronKeyboard?: {
      hideKeyboard: () => void;
      showKeyboard: () => void;
      disableKeyboard: () => void;
      enableKeyboard: () => void;
    };
    electronReload?: {
      reload: () => void;
    };
  }
}

window.electronKeyboard = {
  hideKeyboard: () => ipcRenderer.send('hide-keyboard'),
  showKeyboard: () => ipcRenderer.send('show-keyboard'),
  disableKeyboard: () => ipcRenderer.send('disable-keyboard'),
  enableKeyboard: () => ipcRenderer.send('enable-keyboard'),
};

window.electronReload = {
  reload: () => ipcRenderer.send('go-home'),
};

function reportUserActivity() {
  ipcRenderer.send('user-activity');
}
window.addEventListener('click', reportUserActivity);
window.addEventListener('touchstart', reportUserActivity);
window.addEventListener('mousedown', reportUserActivity);
window.addEventListener('keydown', reportUserActivity);

const INPUT_TAGS = ['INPUT', 'TEXTAREA'];

window.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement;
  if (target && INPUT_TAGS.includes(target.tagName)) {
    console.log('Focus on input detected, showing keyboard.');
    ipcRenderer.send('show-keyboard');
  }
});
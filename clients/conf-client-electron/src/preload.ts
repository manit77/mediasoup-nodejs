import { ipcRenderer } from 'electron';

const INPUT_TAGS = ['INPUT', 'TEXTAREA'];

window.addEventListener('focusin', (event) => {
  const target = event.target as HTMLElement;
  if (target && INPUT_TAGS.includes(target.tagName)) {
    console.log('Focus on input detected, showing keyboard.');
    ipcRenderer.send('show-keyboard');
  }
});
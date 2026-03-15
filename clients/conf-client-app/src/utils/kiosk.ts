/**
 * Kiosk utilities for the Electron app. These functions call into the preload API
 * (window.electron). They no-op when not running inside Electron.
 */

interface ElectronKioskAPI {
  hideKeyboard: () => void;
  showKeyboard: () => void;
  disableKeyboard: () => void;
  enableKeyboard: () => void;
  goHome: () => void;
  reloadConfig: () => void;
  reportFocusedInput: () => void;
}

declare global {
  interface Window {
    electron?: ElectronKioskAPI;
  }
}

function getElectron(): ElectronKioskAPI | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.electron;
}

/** Hide the on-screen keyboard (Electron only). */
export function hideKeyboard(): void {
  getElectron()?.hideKeyboard();
}

/** Show the on-screen keyboard (Electron only). */
export function showKeyboard(): void {
  getElectron()?.showKeyboard();
}

/** Disable the on-screen keyboard (Electron only). */
export function disableKeyboard(): void {
  getElectron()?.disableKeyboard();
}

/** Enable the on-screen keyboard (Electron only). */
export function enableKeyboard(): void {
  getElectron()?.enableKeyboard();
}

/** Navigate to home / reload home route (Electron only). */
export function goHome(): void {
  getElectron()?.goHome();
}

/** Reload kiosk config from disk (Electron only). */
export function reloadConfig(): void {
  getElectron()?.reloadConfig();
}

/** Report the currently focused input's rect so the host can scroll it into view (Electron only). */
export function reportFocusedInput(): void {
  getElectron()?.reportFocusedInput();
}

/** True when running inside the Electron kiosk host (window.electron is defined). */
export function isElectronKiosk(): boolean {
  return typeof window !== 'undefined' && typeof getElectron() !== 'undefined';
}

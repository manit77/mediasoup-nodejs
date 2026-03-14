// --- Configuration ---
export interface AppConfig {
  startUrl: string;
  /** When true, run in kiosk mode. Env: CONFCLIENT_IS_KIOSK (default: false). */
  isKiosk?: boolean;
  /** When true, the on-screen keyboard can be shown. Env: CONFCLIENT_ENABLE_KEYBOARD (default: false). */
  enableKeyboard?: boolean;
  /**
   * When true, allow F12 to toggle DevTools.
   * Can be set via config.json or the CONFCLIENT_ENABLE_JSCONSOLE env var.
   */
  enableJSConsole?: boolean;
}

export enum ipcCommands {
  hideKeyboard = "hide-keyboard",
  showKeyboard = "show-keyboard",
  disableKeyboard = "disable-keyboard",
  enableKeyboard = "enable-keyboard",
  goHome = "go-home",
  userActivity = "user-activity",
  keyPress = "key-press",
  reloadConfig = "reload-config"
}





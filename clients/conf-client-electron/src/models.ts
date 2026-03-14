import { ipcRenderer } from "electron";

// --- Configuration ---
export interface AppConfig {
  startUrl: string;
  /**
   * When true, allow F12 to toggle DevTools.
   * Can be set via config.json or the KIOSK_ENABLE_JSCONSOLE env var.
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





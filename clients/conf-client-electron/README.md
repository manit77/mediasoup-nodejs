# conf-client-electron

Electron wrapper for the conference web application. It loads the hosted app in a main webview and provides an on-screen keyboard in a separate bottom panel, with a toolbar (Home, Language, Show/Hide keyboard).

## Run and build

- **Start (dev):** `npm run start` — builds TypeScript, copies assets to `dist/`, then launches Electron.
- **Build only:** `npm run build` — compiles `src/` to `dist/` and runs the postbuild copy step.

## Configuration

- **`src/config.json`** — `startUrl`: URL of the conference web app (e.g. `https://host:3000/login`). The built app uses `dist/config.json`.
- **Environment:** `ELECTRON_START_URL` overrides the configured start URL when set.

## Architecture

- **Main window** — No web content; only hosts the two views.
- **Remote view (BrowserView)** — Loads the conference app from `startUrl`. Has a preload script that exposes the keyboard hooks and auto-shows the keyboard when an input or textarea is focused (unless the keyboard is disabled).
- **Keyboard view (BrowserView)** — Renders the on-screen keyboard (simple-keyboard) and a bottom toolbar:
  - **Home** — Reloads the remote app to the start URL.
  - **Language** — Opens a language picker and shows the keyboard; supports multiple layouts (e.g. en, es, fr, de, ru, ar, zh, ja, ko).
  - **Show / Hide keyboard** — Toggles the keyboard panel (toolbar stays visible).

Keyboard key events are sent from the keyboard view to the main process and then injected into the remote view, so the hosted app receives them as if from a physical keyboard (including Tab, Enter, Backspace, and characters).

Screen sharing in the hosted app is supported via Electron’s `setDisplayMediaRequestHandler` and `desktopCapturer` (e.g. grant Screen Recording on macOS).

---

## JavaScript hooks for the hosted web app

The preload script exposes a small API on `window.electronKeyboard` so the **hosted conference app** can control the on-screen keyboard from JavaScript. Use optional chaining if the app might run in a normal browser where this API is absent.

| Method | Description |
|--------|-------------|
| `showKeyboard()` | Shows the on-screen keyboard panel. |
| `hideKeyboard()` | Hides the keyboard panel (toolbar remains). |
| `disableKeyboard()` | Hides the keyboard and disables it: it will not auto-show on input focus, and `showKeyboard()` is ignored until `enableKeyboard()` is called. |
| `enableKeyboard()` | Re-enables the keyboard so it can be shown again and auto-show on focus works. |

### Example usage

```javascript
// Show or hide the keyboard
window.electronKeyboard?.showKeyboard();
window.electronKeyboard?.hideKeyboard();

// Disable the keyboard (e.g. when not needed on a page)
window.electronKeyboard?.disableKeyboard();

// Re-enable the keyboard
window.electronKeyboard?.enableKeyboard();
```

### Auto-show behavior

When the keyboard is **enabled**, focusing an `<input>` or `<textarea>` in the hosted app automatically shows the keyboard. When the keyboard is **disabled**, that behavior is turned off until `enableKeyboard()` is called again.

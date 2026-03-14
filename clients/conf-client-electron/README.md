# conf-client-electron

Electron wrapper for the conference web application. It loads the hosted app in a main webview and provides an on-screen keyboard in a separate bottom panel, with a toolbar (Home, Language, Show/Hide keyboard).

## Run and build (development)

- **Start (dev):** `npm run start` — builds TypeScript, copies assets to `dist/`, then launches Electron.
- **Build only:** `npm run build` — compiles `src/` to `dist/` and runs the postbuild copy step.

## Building for distribution (Mac and Windows)

Packaged installers and executables are produced with [electron-builder](https://www.electron.build/). Output goes to the `release/` directory.

### Prerequisites

- **Node.js** (LTS) and **npm**
- **macOS:** Xcode Command Line Tools (for Mac builds). For signing/notarization, configure code signing in the `build` section of `package.json` and set env vars as per electron-builder docs.
- **Windows:** Builds can be run from macOS (using Wine for some installers) or on Windows. For native Windows builds, run the commands below on a Windows machine.

### Install dependencies

From the `clients/conf-client-electron` directory (or the repo root if using a monorepo):

```bash
npm install
```

### Build for macOS

1. Run the build and package for the current platform (mac):

   ```bash
   npm run dist:mac
   ```

2. Find the app and/or DMG in `release/`:
   - **App:** `release/mac/Conference Client.app`
   - **DMG (if configured):** `release/Conference Client-1.0.0.dmg` (or similar)

### Build for Windows

1. On a Windows machine (or with Wine on macOS/Linux for some targets), run:

   ```bash
   npm run dist:win
   ```

2. Find installers in `release/`:
   - **NSIS installer:** `release/Conference Client Setup 1.0.0.exe` (or similar)
   - **Portable:** `release/Conference Client 1.0.0.exe` (portable executable)

### Build for both platforms

To build for the current OS only (mac on Mac, win on Windows):

```bash
npm run dist
```

To build for Mac and Windows from one machine, run `npm run dist:mac` and `npm run dist:win` (Windows build may require Wine on non-Windows hosts for full support).

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

/**
 * Window lifecycle manager.
 *
 * One main canvas window, plus zero-or-more detached "widget" windows that
 * reparent a canvas widget out of the main window (spec 00, native-window
 * style workflow for multi-monitor users).
 *
 * Stub: wires up the BrowserWindow constructor and preload plumbing but
 * does not implement detach logic yet.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, screen } from 'electron';
import { guardNavigation } from './navigation.js';

/**
 * Background color used while the BrowserWindow paints before the renderer
 * takes over. Matches `--canvas-bg` in `renderer/index.css` so there's no
 * visible seam at the rounded window corners (Freeform-style aesthetic).
 */
const CANVAS_BG_DARK = '#171717';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the esbuild-emitted CJS preload script.
 *
 *  Electron's sandboxed preload loader can only execute CommonJS. But with
 *  `"type": "module"` in package.json (needed so main can import ESM-only
 *  workspace deps), electron-vite v5 forces the preload it builds to ESM
 *  `.mjs` and silently ignores format overrides. So we bypass it: a
 *  sibling `scripts/build-preload.mjs` invokes esbuild directly to emit
 *  CJS `out/preload-cjs/index.js`, which this path loads. The
 *  electron-vite-emitted `out/preload/index.mjs` is an unused artifact —
 *  kept only so electron-vite's watcher stays happy. */
const PRELOAD_PATH = join(__dirname, '../preload-cjs/index.js');

/** Dev server URL (set by electron-vite) or file:// URL to the built HTML. */
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_FILE = join(__dirname, '../renderer/index.html');

/** webPreferences baseline shared by every window we create. */
const SECURE_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webviewTag: false,
  spellcheck: false,
} as const;

export interface WindowManager {
  createMainWindow(): BrowserWindow;
  /**
   * Detach a canvas widget into its own frameless window. The widget entity
   * ID is used to reattach if the user closes the detached window.
   */
  detachWidget(widgetId: string): BrowserWindow;
  getMainWindow(): BrowserWindow | null;
}

export function createWindowManager(): WindowManager {
  let mainWindow: BrowserWindow | null = null;

  function loadRenderer(win: BrowserWindow, route = '/'): void {
    if (RENDERER_URL) {
      void win.loadURL(`${RENDERER_URL}#${route}`);
    } else {
      void win.loadFile(RENDERER_FILE, { hash: route });
    }
  }

  function createMainWindow(): BrowserWindow {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      return mainWindow;
    }

    // Open at the full work area (primary display minus menu bar and dock),
    // same footprint Apple Freeform uses on launch.
    const { workArea } = screen.getPrimaryDisplay();

    mainWindow = new BrowserWindow({
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
      minWidth: 1100,
      minHeight: 720,
      show: false,
      backgroundColor: CANVAS_BG_DARK,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      // Align the three traffic lights with the top row of our floating
      // 40x40 buttons (top:16, button center y = 36). macOS dot height is
      // ~12px, so y = 30 centers them on the same axis.
      trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 22 } : undefined,
      webPreferences: { ...SECURE_WEB_PREFERENCES },
    });

    guardNavigation(mainWindow);
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
      // Open DevTools automatically in dev so we can see runtime errors.
      if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
      }
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    loadRenderer(mainWindow);
    return mainWindow;
  }

  function detachWidget(widgetId: string): BrowserWindow {
    const win = new BrowserWindow({
      width: 600,
      height: 400,
      frame: false,
      show: false,
      webPreferences: { ...SECURE_WEB_PREFERENCES },
    });
    guardNavigation(win);
    win.once('ready-to-show', () => win.show());
    loadRenderer(win, `/widget/${encodeURIComponent(widgetId)}`);
    return win;
  }

  return {
    createMainWindow,
    detachWidget,
    getMainWindow: () => mainWindow,
  };
}

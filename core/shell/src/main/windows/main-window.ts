/**
 * Main-window factory (spec 05 §4.1).
 *
 * Opens at the primary display's work area (Freeform aesthetic) with
 * macOS hidden-inset traffic lights. Caller wires
 * `webContents.on('ready-to-show')` for handshake delivery — we only
 * `show()` on `ready-to-show` here.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, screen } from 'electron';
import { guardNavigation } from './navigation-guard.js';
import { SECURE_WEB_PREFERENCES } from './web-preferences.js';

/**
 * Background color used while the BrowserWindow paints before the renderer
 * takes over. Matches `--canvas-bg` in `renderer/styles/index.css` so
 * there's no visible seam at the rounded window corners.
 */
const CANVAS_BG_DARK = '#171717';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_FILE = join(__dirname, '../../renderer/index.html');

export interface CreateMainWindowOptions {
  /** Called synchronously on the `ready-to-show` event, before `show()`. */
  onReadyToShow?: (win: BrowserWindow) => void;
  /** Route hash to append (defaults to `/`). */
  route?: string;
}

export function createMainWindow(opts: CreateMainWindowOptions = {}): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: CANVAS_BG_DARK,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 22 } : undefined,
    webPreferences: { ...SECURE_WEB_PREFERENCES },
  });

  guardNavigation(win);

  win.once('ready-to-show', () => {
    opts.onReadyToShow?.(win);
    win.show();
    if (RENDERER_URL) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  const route = opts.route ?? '/';
  if (RENDERER_URL) {
    void win.loadURL(`${RENDERER_URL}#${route}`);
  } else {
    void win.loadFile(RENDERER_FILE, { hash: route });
  }

  return win;
}

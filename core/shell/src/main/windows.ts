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
import { BrowserWindow, shell } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the electron-vite-emitted preload script. */
const PRELOAD_PATH = join(__dirname, '../preload/index.js');

/** Dev server URL (set by electron-vite) or file:// URL to the built HTML. */
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_FILE = join(__dirname, '../renderer/index.html');

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

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: {
        preload: PRELOAD_PATH,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Open external links in the OS browser, never a new BrowserWindow.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
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
      webPreferences: {
        preload: PRELOAD_PATH,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
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

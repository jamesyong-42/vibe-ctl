/**
 * Window lifecycle manager.
 *
 * One main canvas window, plus zero-or-more detached widget windows.
 * Phase-1: only the main-window factory is wired. `detachWidget` is a
 * `NotImplemented` stub — Phase 7 rewrites it against ephemeral
 * sessions + the renderer-to-renderer port bridge.
 */

import type { BrowserWindow } from 'electron';
import { type CreateMainWindowOptions, createMainWindow } from './main-window.js';

export interface WindowManager {
  createMainWindow(opts?: CreateMainWindowOptions): BrowserWindow;
  detachWidget(widgetId: string): BrowserWindow;
  getMainWindow(): BrowserWindow | null;
}

export function createWindowManager(): WindowManager {
  let mainWindow: BrowserWindow | null = null;

  return {
    createMainWindow(opts) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        return mainWindow;
      }
      const win = createMainWindow(opts);
      mainWindow = win;
      win.on('closed', () => {
        if (mainWindow === win) mainWindow = null;
      });
      return win;
    },
    detachWidget(_widgetId) {
      throw new Error('NotImplemented: detachWidget (arrives in Phase 7)');
    },
    getMainWindow() {
      return mainWindow;
    },
  };
}

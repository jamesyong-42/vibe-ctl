/**
 * Single-instance lock (spec 05 §14 invariant 1).
 *
 * Enforces one main process per user at a time. Called synchronously
 * from the boot entry before any windows are created — if another
 * instance is already running, this process quits immediately and the
 * existing instance's `second-instance` handler focuses its window.
 */

import { app } from 'electron';

/**
 * Lightweight handle the single-instance wiring needs to surface the
 * existing window. `createMainWindow()` is called defensively if the
 * user somehow triggers `second-instance` while the main window is
 * gone (e.g. hidden on macOS with tray-only running).
 */
export interface SingleInstanceWindowRef {
  getMainWindow(): import('electron').BrowserWindow | null;
  createMainWindow(): import('electron').BrowserWindow;
}

/**
 * Claim the single-instance lock. Returns true if this process is the
 * primary instance and should continue booting; false if another
 * instance already holds the lock (caller should quit).
 *
 * The `windowsRef` is a late-bound handle — at this call site the
 * window manager doesn't exist yet. We register the `second-instance`
 * handler now and let it dereference the ref once windows are up.
 */
export function acquireSingleInstanceLock(windowsRef: {
  current: SingleInstanceWindowRef | null;
}): boolean {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    const windows = windowsRef.current;
    if (!windows) return;
    const existing = windows.getMainWindow();
    if (!existing) {
      windows.createMainWindow();
      return;
    }
    if (existing.isMinimized()) existing.restore();
    existing.focus();
  });

  return true;
}

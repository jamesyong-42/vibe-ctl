/**
 * Per-window navigation guards.
 *
 * Applied to every BrowserWindow we create. Prevents the renderer from
 * being coerced into loading attacker-controlled content:
 *
 *   - `will-navigate` — block any top-level navigation to an origin
 *     that isn't our dev server or packaged file://.
 *   - `will-attach-webview` — deny <webview> entirely; plugins should
 *     use our managed BrowserWindow detach flow, not raw webviews.
 *   - `setWindowOpenHandler` — defer external URLs to the OS browser,
 *     deny in-app window creation.
 */

import { type BrowserWindow, shell } from 'electron';

const DEV_URL = process.env.ELECTRON_RENDERER_URL;

function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') return true;
    if (parsed.protocol === 'host:' || parsed.protocol === 'plugin:') return true;
    if (DEV_URL) {
      const dev = new URL(DEV_URL);
      if (parsed.origin === dev.origin) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function guardNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) return { action: 'deny' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

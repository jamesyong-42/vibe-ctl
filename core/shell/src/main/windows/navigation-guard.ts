/**
 * Per-window navigation guards (spec 05 §8.3).
 *
 * Applied to every BrowserWindow we create. Prevents the renderer from
 * being coerced into loading attacker-controlled content:
 *
 *   - `will-navigate` — block any top-level navigation to an origin
 *     that isn't our dev server, `host:`, `plugin:`, or the packaged
 *     `file:` HTML entry. External URLs → `shell.openExternal`.
 *   - `will-attach-webview` — deny `<webview>` entirely. No webviews
 *     ever. Plugins use the managed BrowserWindow detach flow.
 *   - `setWindowOpenHandler` — always `{ action: 'deny' }`; external
 *     URLs forwarded to OS browser; in-app popups forbidden.
 */

import { createScopedLogger } from '@vibe-ctl/runtime';
import { type BrowserWindow, shell } from 'electron';

const log = createScopedLogger('shell:navigation-guard');
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
      log.warn({ url }, 'blocked will-navigate to external URL');
      void shell.openExternal(url);
    }
  });

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    log.warn('blocked will-attach-webview — webviews are never allowed');
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalUrl(url)) {
      log.debug({ url }, 'window.open redirected to OS browser');
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

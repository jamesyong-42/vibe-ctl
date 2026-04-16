/**
 * System tray icon + quick-action menu.
 *
 * Stub: first-party plugins (notifications, dynamic-island, quick-actions)
 * contribute actual menu entries via the tray contribution point once the
 * plugin API surface is wired. For now, we render a static skeleton.
 */

import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';

export interface TrayHandle {
  readonly tray: Tray;
  dispose(): void;
}

export function createTray(): TrayHandle {
  // TODO: replace with a packaged template image (resources/icons/tray.png).
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);
  tray.setToolTip('vibe-ctl');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open vibe-ctl',
      click: () => {
        const existing = BrowserWindow.getAllWindows()[0];
        if (existing) existing.focus();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);

  return {
    tray,
    dispose() {
      tray.destroy();
    },
  };
}

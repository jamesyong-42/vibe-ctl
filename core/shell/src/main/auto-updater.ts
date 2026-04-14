/**
 * electron-updater integration.
 *
 * Background update check + install on next launch. Uses whatever feed
 * electron-builder is configured to publish to (GitHub Releases by
 * default; see apps/desktop/electron-builder.yml). Skipped entirely in
 * development where `app.isPackaged` is false.
 *
 * Events are logged to stdout. UI-facing progress will be bridged via
 * IPC once the renderer surface is defined.
 */

import { app } from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;

/** Re-check every six hours after the first launch check. */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initAutoUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[vibe-ctl] auto-updater error', err);
  });

  autoUpdater.on('update-available', (info) => {
    // eslint-disable-next-line no-console
    console.log('[vibe-ctl] update available', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // eslint-disable-next-line no-console
    console.log('[vibe-ctl] update downloaded, will install on quit', info.version);
  });

  void autoUpdater.checkForUpdates();
  setInterval(() => {
    void autoUpdater.checkForUpdates();
  }, RECHECK_INTERVAL_MS);
}

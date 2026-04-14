/**
 * electron-updater integration.
 *
 * Stub: packaging (spec 03 §7) will wire this to GitHub Releases feeds.
 * Kept as a no-op until electron-builder is configured end-to-end.
 */

export function initAutoUpdater(): void {
  // TODO: import { autoUpdater } from 'electron-updater'; check for updates
  //       on a timer, surface progress to the renderer via IPC.
}

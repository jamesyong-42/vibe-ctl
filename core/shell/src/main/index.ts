/**
 * Electron main-process entry for `@vibe-ctl/shell`.
 *
 * Implements the bootstrap sequence of spec 02 §10:
 *
 *   1. Electron main starts (this file)
 *   2. Platform layer ready (windows, tray, menu handles prepared)
 *   3. Runtime.start(): sync fabric → version gate → discover → resolve
 *      → activate eager plugins (the Runtime walks steps 3–8 internally)
 *   4. Create the main window; renderer boots and mounts canvas placements
 *   5. On `before-quit` or `window-all-closed` (non-mac): Runtime.stop()
 *
 * Kept deliberately stub-shaped — real Runtime wiring is out of scope
 * for the scaffold. Sketch only.
 */

import { resolve } from 'node:path';
import { Runtime } from '@vibe-ctl/runtime';
import { BrowserWindow, app } from 'electron';
import { initAutoUpdater } from './auto-updater.js';
import { createAppMenu } from './menu.js';
import { registerProtocols } from './protocol.js';
import { type TrayHandle, createTray } from './tray.js';
import { type WindowManager, createWindowManager } from './windows.js';

let runtime: Runtime | null = null;
let windows: WindowManager | null = null;
let tray: TrayHandle | null = null;

async function boot(): Promise<void> {
  await app.whenReady();

  // --- Step 2: platform layer --------------------------------------------
  registerProtocols();
  createAppMenu();

  // --- Step 3: construct + start the runtime -----------------------------
  // The Runtime owns the sync fabric, version gate, discovery, resolution,
  // and plugin activation (spec 02 §10 steps 3–8). The shell only provides
  // platform-layer wiring.
  runtime = new Runtime({
    // Scan the packaged resources dir first, then the user-data dir.
    builtInPluginRoots: [resolve(process.resourcesPath ?? '', 'plugins')],
    pluginDirs: [resolve(app.getPath('userData'), 'plugins')],
    devPluginRoots: process.env.VIBE_CTL_DEV_PLUGINS?.split(',').filter(Boolean),
    // Canvas engine handle is wired from the renderer; main-process runtime
    // gets a placeholder until the canvas adapter protocol is fleshed out.
    canvasEngine: null,
    logger: console,
    kernelVersion: app.getVersion(),
    userDataDir: app.getPath('userData'),
    // TODO: stable device identity. Placeholder: hostname + pid.
    deviceId: `${process.env.HOSTNAME ?? 'unknown'}-${process.pid}`,
    deviceName: process.env.HOSTNAME ?? 'unknown',
  });

  // TODO: version gate lives inside Runtime.start() per spec 02 §10 step 4.
  // If it reports "behind", the shell should render <VersionGate /> in the
  // main window and NOT create additional windows.
  await runtime.discover();
  await runtime.resolve();
  await runtime.start();

  // --- Step 4: platform UI chrome ----------------------------------------
  windows = createWindowManager();
  tray = createTray();
  void tray;
  windows.createMainWindow();

  initAutoUpdater();

  // Re-open the main window on macOS dock activation.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windows?.createMainWindow();
    }
  });
}

// --- Teardown -----------------------------------------------------------

app.on('before-quit', async (event) => {
  if (!runtime) return;
  event.preventDefault();
  try {
    await runtime.stop();
  } finally {
    runtime = null;
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[vibe-ctl] boot failed', err);
  app.exit(1);
});

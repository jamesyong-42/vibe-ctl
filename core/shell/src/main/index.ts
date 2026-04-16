/**
 * Electron main-process composition root for `@vibe-ctl/shell`.
 *
 * Implements the bootstrap sequence of spec 02 §10 and the tri-process
 * topology of spec 05 §2. Stays thin by design — every concern (single
 * instance, lifecycle, fuse check, deep links, windows, kernel spawn,
 * IPC) lives in its own module.
 *
 * Sketch:
 *   1. app.setName + app.enableSandbox (must precede app-ready).
 *   2. Acquire single-instance lock; quit early if a peer holds it.
 *   3. whenReady() → platform layer (security, protocols, menu).
 *   4. Construct + start the Runtime (stub until Phase 1 commit 10).
 *   5. Create the main window + tray + auto-updater wiring.
 *   6. Register app lifecycle hooks (activate / before-quit / all-closed).
 */

import { resolve } from 'node:path';
import { Runtime, createScopedLogger } from '@vibe-ctl/runtime';
import { app } from 'electron';
import { registerDeepLinks } from './app/deep-links.js';
import { runFuseCheck } from './app/fuse-check.js';
import { registerLifecycleHooks } from './app/lifecycle.js';
import { acquireSingleInstanceLock } from './app/single-instance.js';
import { initAutoUpdater } from './auto-updater.js';
import { registerHostDispatcher } from './ipc/index.js';
import { createAppMenu } from './menu.js';
import { registerProtocols } from './protocol.js';
import { setupSecurity } from './security.js';
import { createTray } from './tray.js';
import { type WindowManager, createWindowManager } from './windows.js';

const log = createScopedLogger('shell:main');

// Override Electron's default app name (derived from the shell package's
// `@vibe-ctl/shell`) so `userData`, the menu bar label, and the tray
// tooltip all use a clean `vibe-ctl`. Must precede any `app.getPath()`.
app.setName('vibe-ctl');

// Enforce process sandboxing for every renderer and utilityProcess
// regardless of per-window webPreferences. Must run before app-ready.
app.enableSandbox();

// Late-bound refs used by lifecycle + single-instance handlers that are
// registered before the objects they refer to exist.
const windowsRef: {
  current: WindowManager | null;
} = { current: null };
const runtimeRef: { current: Runtime | null } = { current: null };

const gotLock = acquireSingleInstanceLock(windowsRef);

async function boot(): Promise<void> {
  await app.whenReady();

  // --- Step 2: platform layer --------------------------------------------
  runFuseCheck();
  setupSecurity();
  registerProtocols();
  createAppMenu();
  registerDeepLinks({});
  registerHostDispatcher();

  // --- Step 3: construct + start the runtime -----------------------------
  const runtime = new Runtime({
    // Scan the packaged resources dir first, then the user-data dir.
    builtInPluginRoots: [resolve(process.resourcesPath ?? '', 'plugins')],
    pluginDirs: [resolve(app.getPath('userData'), 'plugins')],
    devPluginRoots: process.env.VIBE_CTL_DEV_PLUGINS?.split(',').filter(Boolean),
    // Canvas engine handle is wired from the renderer; main-process runtime
    // gets a placeholder until the canvas adapter protocol is fleshed out.
    canvasEngine: null,
    logger: createScopedLogger('runtime'),
    kernelVersion: app.getVersion(),
    userDataDir: app.getPath('userData'),
    // TODO: stable device identity. Placeholder: hostname + pid.
    deviceId: `${process.env.HOSTNAME ?? 'unknown'}-${process.pid}`,
    deviceName: process.env.HOSTNAME ?? 'unknown',
  });
  runtimeRef.current = runtime;

  await runtime.discover();
  await runtime.resolve();
  await runtime.start();

  // --- Step 4: platform UI chrome ----------------------------------------
  const windows = createWindowManager();
  windowsRef.current = windows;
  createTray();
  windows.createMainWindow();

  initAutoUpdater();
}

// Lifecycle hooks are registered eagerly so `before-quit` fires even if
// boot() throws halfway through.
registerLifecycleHooks({ runtimeRef, windowsRef });

if (gotLock) {
  boot().catch((err) => {
    log.error({ err }, 'boot failed');
    app.exit(1);
  });
}

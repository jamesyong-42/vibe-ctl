/**
 * Electron main-process composition root for `@vibe-ctl/shell`.
 *
 * Implements the bootstrap sequence of spec 02 §10 and the tri-process
 * topology of spec 05 §2. Stays thin by design — every concern (single
 * instance, lifecycle, fuse check, deep links, windows, kernel spawn,
 * IPC) lives in its own module.
 *
 * Order:
 *   1. app.setName + app.enableSandbox (must precede app-ready).
 *   2. Acquire single-instance lock; quit early if a peer holds it.
 *   3. whenReady() → platform layer (security, protocols, menu, dispatcher).
 *   4. Fork the kernel utility, wrap its ctrl port with Comlink, pass the
 *      proxy into Runtime. Runtime.start() awaits kernelCtrl.start().
 *   5. Create the main window. On `ready-to-show`, mint event + doc-sync
 *      ports, send the handshake, and show the window.
 *   6. Register app lifecycle hooks (activate / before-quit / all-closed).
 */

import { resolve } from 'node:path';
import { Runtime, createScopedLogger } from '@vibe-ctl/runtime';
import { app } from 'electron';
// Side-effect: registerSchemesAsPrivileged MUST run before app.whenReady().
import './protocols/register.js';
import { registerDeepLinks } from './app/deep-links.js';
import { runFuseCheck } from './app/fuse-check.js';
import { registerLifecycleHooks } from './app/lifecycle.js';
import { acquireSingleInstanceLock } from './app/single-instance.js';
import { initAutoUpdater } from './auto-updater.js';
import { createBroker, registerHostDispatcher, sendHandshake } from './ipc/index.js';
import { type KernelSupervisor, startKernelSupervisor } from './kernel/index.js';
import { createAppMenu } from './menu.js';
import { registerHostProtocol, registerPluginProtocol } from './protocols/index.js';
import { setupSessionSecurity } from './security/index.js';
import { createTray } from './tray.js';
import { type WindowManager, createWindowManager } from './windows/index.js';

const log = createScopedLogger('shell:main');

// Override Electron's default app name so `userData`, the menu-bar label,
// and the tray tooltip all read `vibe-ctl`. Must precede `app.getPath()`.
app.setName('vibe-ctl');

// Enforce sandboxing for every renderer and utilityProcess. Must run
// before app-ready.
app.enableSandbox();

const windowsRef: { current: WindowManager | null } = { current: null };
const runtimeRef: { current: Runtime | null } = { current: null };
const kernelRef: { current: KernelSupervisor | null } = { current: null };

const gotLock = acquireSingleInstanceLock(windowsRef);

async function boot(): Promise<void> {
  await app.whenReady();

  // --- Step 2: platform layer --------------------------------------------
  runFuseCheck();
  setupSessionSecurity();
  registerHostProtocol();
  registerPluginProtocol();
  createAppMenu();
  registerDeepLinks({});
  registerHostDispatcher();

  // --- Step 3: fork + wrap the kernel utility ----------------------------
  const kernel = await startKernelSupervisor();
  kernelRef.current = kernel;

  // --- Step 4: construct + start the runtime -----------------------------
  const runtime = new Runtime({
    builtInPluginRoots: [resolve(process.resourcesPath ?? '', 'plugins')],
    pluginDirs: [resolve(app.getPath('userData'), 'plugins')],
    devPluginRoots: process.env.VIBE_CTL_DEV_PLUGINS?.split(',').filter(Boolean),
    canvasEngine: null,
    logger: createScopedLogger('runtime'),
    kernelVersion: app.getVersion(),
    userDataDir: app.getPath('userData'),
    deviceId: `${process.env.HOSTNAME ?? 'unknown'}-${process.pid}`,
    deviceName: process.env.HOSTNAME ?? 'unknown',
    kernelCtrl: kernel.ctrl,
  });
  runtimeRef.current = runtime;

  await runtime.discover();
  await runtime.resolve();
  await runtime.start();

  // --- Step 5: main window + handshake delivery --------------------------
  const broker = createBroker();
  const windows = createWindowManager();
  windowsRef.current = windows;
  createTray();

  const win = windows.createMainWindow({
    onReadyToShow: (w) => {
      const ports = broker.mintForWindow(w.id);
      sendHandshake(
        w,
        {
          deviceId: runtime.options.deviceId,
          deviceName: runtime.options.deviceName,
          kernelVersion: runtime.options.kernelVersion,
          pluginRpcOrder: [],
        },
        ports,
      );
    },
  });
  win.on('closed', () => {
    broker.releaseWindow(win.id);
  });

  initAutoUpdater();
}

// Lifecycle hooks are registered eagerly so `before-quit` fires even if
// boot() throws halfway through.
registerLifecycleHooks({ runtimeRef, windowsRef });

app.on('before-quit', () => {
  // Tear the kernel utility down after the runtime has stopped. The
  // supervisor's kill() is a last-ditch SIGTERM; Phase 4 adds the
  // cooperative `{type:'shutdown'}` message here.
  const kernel = kernelRef.current;
  if (!kernel) return;
  try {
    kernel.kill();
  } catch (err) {
    log.warn({ err }, 'kernel.kill() threw');
  }
  kernelRef.current = null;
});

if (gotLock) {
  boot().catch((err) => {
    log.error({ err }, 'boot failed');
    app.exit(1);
  });
}

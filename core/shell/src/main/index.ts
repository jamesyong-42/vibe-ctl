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

import { join, resolve } from 'node:path';
import {
  type EventPortMessage,
  Runtime,
  createLogger,
  createScopedLogger,
  setRootLogger,
} from '@vibe-ctl/runtime';
import { app } from 'electron';
// Side-effect: registerSchemesAsPrivileged MUST run before app.whenReady().
import './protocols/register.js';
import { registerDeepLinks } from './app/deep-links.js';
import { runFuseCheck } from './app/fuse-check.js';
import { registerLifecycleHooks } from './app/lifecycle.js';
import { acquireSingleInstanceLock } from './app/single-instance.js';
import { initAutoUpdater } from './auto-updater.js';
import { createBroker, registerHostDispatcher, sendHandshake } from './ipc/index.js';
import {
  type KernelSupervisor,
  brokerDocSyncPort,
  brokerEventPort,
  startKernelSupervisor,
} from './kernel/index.js';
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

// Install the rotating file-backed root logger before any sub-module's
// scoped logger is touched. `createScopedLogger` returns live proxies
// (see runtime/src/logging/logger.ts) so swapping the root here takes
// effect across every existing scope — including the `shell:main` logger
// on the next line. Writes to {userData}/logs/main.log with daily
// rotation + 7-day retention (spec 05 §12).
setRootLogger(
  createLogger({
    logDir: join(app.getPath('userData'), 'logs'),
    filename: 'main.log',
    stdoutInDev: true,
  }),
);

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
  // Pass userData as VIBE_CTL_DATA_DIR — the utility's entry.ts uses this
  // for Loro snapshot persistence + truffle's tailscale stateDir. Without
  // it, the utility falls back to process.cwd() which is the shell package
  // dir in dev and writes snapshots into the repo.
  const userDataDir = app.getPath('userData');
  const kernel = await startKernelSupervisor({ dataDir: userDataDir });
  kernelRef.current = kernel;

  // --- Step 4: construct + start the runtime -----------------------------
  const runtime = new Runtime({
    builtInPluginRoots: [resolve(process.resourcesPath ?? '', 'plugins')],
    pluginDirs: [resolve(userDataDir, 'plugins')],
    devPluginRoots: process.env.VIBE_CTL_DEV_PLUGINS?.split(',').filter(Boolean),
    canvasEngine: null,
    logger: createScopedLogger('runtime'),
    kernelVersion: app.getVersion(),
    userDataDir,
    deviceId: `${process.env.HOSTNAME ?? 'unknown'}-${process.pid}`,
    deviceName: process.env.HOSTNAME ?? 'unknown',
    kernelCtrl: kernel.getCtrl()!,
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

  // Forward kernel-utility-originated events (e.g. mesh.auth.required)
  // onto every open renderer's event port. Main is the sole broker
  // between kernel utility and renderer (spec 05 §2).
  //
  // Uses a dedicated MessagePortMain pair, NOT Comlink.proxy — Electron's
  // MessagePortMain cannot transfer a Web MessageChannel port (which is
  // what Comlink.proxy mints), so callback-over-Comlink throws "object
  // could not be cloned".
  const kernelChild = kernel.getChild();
  if (kernelChild) {
    const { mainPort: kernelEventPort } = brokerEventPort(kernelChild);
    kernelEventPort.on('message', (ev) => {
      const msg = ev.data as EventPortMessage;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
      for (const port of broker.eventPorts()) {
        try {
          port.postMessage(msg);
        } catch (err) {
          log.warn({ err, type: msg.type }, 'failed to forward kernel event to renderer');
        }
      }
    });
    kernelEventPort.start();
    log.info('kernel event forwarder active');
  } else {
    log.warn('kernel utility not running — events will not be forwarded');
  }

  const win = windows.createMainWindow({
    onReadyToShow: (w) => {
      const ports = broker.mintForWindow(w.id);
      // Broker the doc-sync port directly: utility end ships to the
      // kernel utility over its parentPort, renderer end travels with
      // the handshake. Main never inspects messages on either side.
      const kernelChild = kernel.getChild();
      if (!kernelChild) {
        log.error('cannot broker doc-sync port: kernel utility not running');
        return;
      }
      const { rendererPort: docSyncRenderer } = brokerDocSyncPort(kernelChild);
      sendHandshake(
        w,
        {
          deviceId: runtime.options.deviceId,
          deviceName: runtime.options.deviceName,
          kernelVersion: runtime.options.kernelVersion,
          pluginRpcOrder: [],
        },
        ports,
        docSyncRenderer,
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

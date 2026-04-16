/**
 * App-wide Electron lifecycle wiring.
 *
 * The bootstrap is split between:
 *   - `single-instance.ts` — lock + second-instance handler
 *   - this file — activate / before-quit / window-all-closed
 *
 * `before-quit` waits for the runtime to drain before exiting; this is
 * the only place `app.exit(0)` is called on the happy path.
 */

import type { Runtime } from '@vibe-ctl/runtime';
import { createScopedLogger } from '@vibe-ctl/runtime';
import { BrowserWindow, app } from 'electron';

const log = createScopedLogger('shell:lifecycle');

export interface LifecycleCtx {
  runtimeRef: { current: Runtime | null };
  windowsRef: {
    current: { getMainWindow(): BrowserWindow | null; createMainWindow(): BrowserWindow } | null;
  };
}

export function registerLifecycleHooks(ctx: LifecycleCtx): void {
  // macOS-only: reopen the main window when the dock icon is clicked
  // and no windows remain.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ctx.windowsRef.current?.createMainWindow();
    }
  });

  app.on('before-quit', (event) => {
    const runtime = ctx.runtimeRef.current;
    if (!runtime) return;
    event.preventDefault();
    void (async () => {
      try {
        await runtime.stop();
      } catch (err) {
        log.error({ err }, 'runtime.stop() threw');
      } finally {
        ctx.runtimeRef.current = null;
        app.exit(0);
      }
    })();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

/**
 * Graceful shutdown wiring for the kernel utility process.
 *
 * Listens for two signals:
 *   1. `SIGTERM` — OS-level shutdown (Electron forwards this on quit).
 *   2. `{ type: 'shutdown' }` on `process.parentPort` — cooperative
 *      shutdown from main over the built-in utility-process pipe.
 *
 * The registered callback is invoked at most once. In Phase 1 the
 * callback is expected to just log; real drain + persistence lands in
 * Phase 4.
 */

import { createScopedLogger } from '../logging/index.js';

const log = createScopedLogger('kernel-utility:shutdown');

type ShutdownCallback = () => Promise<void>;

export function onShutdown(cb: ShutdownCallback): void {
  let fired = false;
  const fire = async (reason: string): Promise<void> => {
    if (fired) return;
    fired = true;
    log.info({ reason }, 'shutdown requested');
    try {
      await cb();
    } catch (err) {
      log.error({ err }, 'shutdown callback failed');
    }
  };

  process.on('SIGTERM', () => {
    void fire('SIGTERM');
  });

  process.parentPort?.on('message', (msg: unknown) => {
    if (
      msg &&
      typeof msg === 'object' &&
      'type' in msg &&
      (msg as { type?: unknown }).type === 'shutdown'
    ) {
      void fire('parentPort:shutdown');
    }
  });
}

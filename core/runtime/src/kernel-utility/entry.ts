/**
 * Kernel utility process entry. Real impl arrives in Phase 1.
 * Spawned via utilityProcess.fork(dist/kernel-utility.js) from the shell's main process.
 *
 * Type note: process.parentPort is exposed by Electron when this module is
 * loaded inside utilityProcess.fork(). We avoid a hard electron dep here by
 * declaring a minimal ambient type for what we actually use — see below.
 */
import { createScopedLogger } from '../logging/index.js';

const log = createScopedLogger('kernel-utility');
log.info('kernel-utility process started (stub)');

process.parentPort?.on('message', (msg) => {
  log.debug({ msg }, 'received message from main (stub)');
});

// Minimal ambient declaration so tsc finds process.parentPort without
// pulling the full electron type surface into @vibe-ctl/runtime.
// The top-level `import` above already makes this file a module, so
// `declare global` is correctly scoped without an `export {}` tail.
declare global {
  namespace NodeJS {
    interface Process {
      parentPort?: {
        on(event: 'message', listener: (msg: unknown) => void): void;
        postMessage(msg: unknown): void;
      };
    }
  }
}

/**
 * Kernel utility process entry (spec 05 §2, §6.4).
 *
 * Spawned by the shell's main process via `utilityProcess.fork(dist/kernel-utility.js)`.
 * The main process transfers a single `MessagePortMain` over
 * `process.parentPort` on startup; this module wires that port to the
 * `KernelCtrl` Comlink service via the shared `nodeEndpoint` adapter
 * in `ipc/comlink-node-adapter.ts`.
 */

import * as Comlink from 'comlink';
import type { NodeMessagePort } from '../ipc/comlink-node-adapter.js';
import { nodeEndpoint } from '../ipc/comlink-node-adapter.js';
import { createScopedLogger } from '../logging/index.js';
import { createCtrlService } from './ctrl-service.js';
import { onShutdown } from './shutdown.js';

const log = createScopedLogger('kernel-utility');

// --- Ambient types we depend on ----------------------------------------
//
// `process.parentPort` only exists inside `utilityProcess.fork`. We avoid
// a hard dep on electron from @vibe-ctl/runtime by declaring a minimal
// ambient surface here.

declare global {
  namespace NodeJS {
    interface Process {
      parentPort?: NodeMessagePort;
    }
  }
}

function main(): void {
  const parentPort = process.parentPort;
  if (!parentPort) {
    log.error('kernel-utility started without process.parentPort — aborting');
    process.exit(1);
    return;
  }

  log.info('kernel-utility process started');

  onShutdown(async () => {
    // Phase-1: nothing to drain. Phase-4 will close Loro docs + stop NapiNode.
  });

  // Main transfers exactly one MessagePortMain (the ctrl port) on the
  // first parentPort message. Once received, wire Comlink and move on.
  const onFirstMessage = (ev: { data: unknown; ports?: unknown[] }): void => {
    const ports = ev.ports ?? [];
    if (ports.length === 0) {
      log.warn({ msg: ev.data }, 'first parentPort message had no ports — ignoring');
      return;
    }
    parentPort.off?.('message', onFirstMessage);
    const ctrlPort = ports[0] as NodeMessagePort | undefined;
    if (!ctrlPort) return;
    ctrlPort.start?.();
    Comlink.expose(createCtrlService(), nodeEndpoint(ctrlPort));
    log.info('ctrl port wired; kernel utility ready');
  };
  parentPort.on('message', onFirstMessage);
}

main();

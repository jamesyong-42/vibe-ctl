/**
 * Kernel utility process entry (spec 05 §2, §6.4).
 *
 * Spawned by the shell's main process via `utilityProcess.fork(dist/kernel-utility.js)`.
 * The main process transfers a single `MessagePortMain` over
 * `process.parentPort` on startup; this module wires that port to the
 * `KernelCtrl` Comlink service.
 *
 * Comlink's shipped node-adapter (`comlink/dist/esm/node-adapter.mjs`)
 * targets Node's `worker_threads` MessagePort where `port.on('message', l)`
 * hands `l` the raw data. Electron's `MessagePortMain` instead delivers
 * a `{ data, ports }` `MessageEvent`-ish object. Rather than fight the
 * import path mismatch (Comlink 4.x has no `exports` field, so
 * `comlink/node-adapter` doesn't resolve cleanly) we ship a ~20-line
 * local adapter that converts a `MessagePortMain` into the
 * `Comlink.Endpoint` shape.
 */

import * as Comlink from 'comlink';
import { createScopedLogger } from '../logging/index.js';
import { createCtrlService } from './ctrl-service.js';
import { onShutdown } from './shutdown.js';

const log = createScopedLogger('kernel-utility');

// --- Ambient types we depend on ----------------------------------------
//
// `process.parentPort` only exists inside `utilityProcess.fork`. We avoid
// a hard dep on electron from @vibe-ctl/runtime by declaring a minimal
// ambient surface here.

interface MessagePortMainLike {
  on(
    event: 'message',
    listener: (ev: { data: unknown; ports?: MessagePortMainLike[] }) => void,
  ): void;
  off?(
    event: 'message',
    listener: (ev: { data: unknown; ports?: MessagePortMainLike[] }) => void,
  ): void;
  postMessage(msg: unknown, transferList?: unknown[]): void;
  start?(): void;
  close?(): void;
}

declare global {
  namespace NodeJS {
    interface Process {
      parentPort?: MessagePortMainLike;
    }
  }
}

/**
 * Adapt an Electron `MessagePortMain` into Comlink's `Endpoint` shape.
 * Comlink calls `addEventListener('message', handler)` where `handler`
 * expects a DOM-ish `MessageEvent` (`.data`, `.ports`). Electron's
 * `MessagePortMain.on('message', l)` already passes `{ data, ports }`
 * — we just translate the subscription API.
 */
type ComlinkEndpointHandler = Parameters<Comlink.Endpoint['addEventListener']>[1];

function mainPortEndpoint(port: MessagePortMainLike): Comlink.Endpoint {
  const wrapped = new WeakMap<
    ComlinkEndpointHandler,
    (ev: { data: unknown; ports?: MessagePortMainLike[] }) => void
  >();
  return {
    postMessage(message: unknown, transfer?: unknown[]) {
      port.postMessage(message, transfer);
    },
    addEventListener: (_type, handler) => {
      const fn = (ev: { data: unknown; ports?: MessagePortMainLike[] }): void => {
        if (typeof handler === 'function') {
          (handler as (ev: unknown) => void)(ev);
        } else if (handler && typeof handler === 'object' && 'handleEvent' in handler) {
          (handler as { handleEvent: (ev: unknown) => void }).handleEvent(ev);
        }
      };
      wrapped.set(handler, fn);
      port.on('message', fn);
    },
    removeEventListener: (_type, handler) => {
      const fn = wrapped.get(handler);
      if (!fn) return;
      port.off?.('message', fn);
      wrapped.delete(handler);
    },
    start: port.start?.bind(port),
  };
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
  const onFirstMessage = (ev: { data: unknown; ports?: MessagePortMainLike[] }): void => {
    const ports = ev.ports ?? [];
    if (ports.length === 0) {
      log.warn({ msg: ev.data }, 'first parentPort message had no ports — ignoring');
      return;
    }
    parentPort.off?.('message', onFirstMessage);
    const [ctrlPort] = ports;
    if (!ctrlPort) return;
    ctrlPort.start?.();
    Comlink.expose(createCtrlService(), mainPortEndpoint(ctrlPort));
    log.info('ctrl port wired; kernel utility ready');
  };
  parentPort.on('message', onFirstMessage);
}

main();

/**
 * Comlink client wrapper for the kernel utility's ctrl port (spec 05 §6.4).
 *
 * The shell's main process holds one `MessagePortMain` per running
 * kernel utility; this module wraps it with Comlink so callers can
 * `await ctrl.getVersion()` as if the utility were in-process.
 *
 * Comlink's published node-adapter targets `worker_threads` MessagePorts,
 * not Electron's `MessagePortMain`. A MessagePortMain's `on('message', …)`
 * listener receives `{ data, ports }` rather than the raw payload, so we
 * ship a tiny local Endpoint adapter (mirror of the one in
 * core/runtime/src/kernel-utility/entry.ts).
 */

import type { KernelCtrl } from '@vibe-ctl/runtime';
import * as Comlink from 'comlink';
import type { MessagePortMain } from 'electron';

type ComlinkEndpointHandler = Parameters<Comlink.Endpoint['addEventListener']>[1];

function mainPortEndpoint(port: MessagePortMain): Comlink.Endpoint {
  const wrapped = new WeakMap<
    ComlinkEndpointHandler,
    (ev: { data: unknown; ports?: readonly MessagePortMain[] }) => void
  >();
  return {
    postMessage(message: unknown, transfer?: unknown[]) {
      port.postMessage(message, transfer as MessagePortMain[] | undefined);
    },
    addEventListener: (_type, handler) => {
      const fn = (ev: { data: unknown; ports?: readonly MessagePortMain[] }): void => {
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
      port.off('message', fn);
      wrapped.delete(handler);
    },
    start: port.start.bind(port),
  };
}

export function createCtrlClient(port: MessagePortMain): Comlink.Remote<KernelCtrl> {
  port.start();
  return Comlink.wrap<KernelCtrl>(mainPortEndpoint(port));
}

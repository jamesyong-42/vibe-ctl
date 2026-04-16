/**
 * Comlink Endpoint adapter for Electron MessagePort / MessagePortMain.
 *
 * Comlink 4.x has no `exports` field so `comlink/node-adapter` is
 * unresolvable. This module provides a single `nodeEndpoint()` function
 * that converts a Node-ish message port (Electron's `MessagePortMain` in
 * the main process **or** `MessagePort` in a utility process) into the
 * `Endpoint` interface that Comlink expects.
 *
 * The port parameter uses a minimal structural interface rather than
 * importing Electron types — this keeps `@vibe-ctl/runtime` free of a
 * hard Electron dependency.
 */

import type { Endpoint } from 'comlink';

/**
 * Minimal structural interface covering both Electron's `MessagePortMain`
 * (main process) and `MessagePort` (utility process).  The `on('message')`
 * listener receives `{ data, ports }` on both.
 */
export interface NodeMessagePort {
  on(event: 'message', listener: (msg: { data: unknown; ports?: unknown[] }) => void): void;
  // biome-ignore lint/suspicious/noExplicitAny: must accept any listener shape for removal
  off?(event: 'message', listener: (...args: any[]) => void): void;
  // biome-ignore lint/suspicious/noExplicitAny: must accept any listener shape for removal
  removeListener?(event: 'message', listener: (...args: any[]) => void): void;
  postMessage(msg: unknown, transfer?: unknown[]): void;
  start?(): void;
}

type ComlinkEndpointHandler = Parameters<Endpoint['addEventListener']>[1];

/**
 * Adapt a Node-ish message port into Comlink's `Endpoint` shape.
 *
 * Comlink calls `addEventListener('message', handler)` where `handler`
 * expects a DOM-ish `MessageEvent` (`.data`, `.ports`).  Electron's
 * port `.on('message', l)` already passes `{ data, ports }` — we just
 * translate the subscription API.
 */
export function nodeEndpoint(port: NodeMessagePort): Endpoint {
  const wrapped = new WeakMap<
    ComlinkEndpointHandler,
    (ev: { data: unknown; ports?: unknown[] }) => void
  >();
  return {
    postMessage(message: unknown, transfer?: unknown[]) {
      port.postMessage(message, transfer);
    },
    addEventListener: (_type, handler) => {
      const fn = (ev: { data: unknown; ports?: unknown[] }): void => {
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
      if (port.off) {
        port.off('message', fn);
      } else if (port.removeListener) {
        port.removeListener('message', fn);
      }
      wrapped.delete(handler);
    },
    start: port.start?.bind(port),
  };
}

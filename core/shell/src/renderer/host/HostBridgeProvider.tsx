/**
 * HostBridgeProvider — renderer-side boot synchronisation (spec 05 §5, §9.1).
 *
 * On mount, subscribes to `window.__vibeCtl.onHostHandshake(…)` and
 * stashes the payload + ports. Always renders children — the provider
 * manages state only and does not participate in UI rendering. The
 * screen-router decides what to show based on bridge readiness (the
 * `'boot'` screen state maps to the handshake-pending phase).
 *
 * Placing this provider outermost (just inside `<LogProvider>` when
 * that lands in Phase 2) means the theme / i18n / screen-state
 * providers below can freely call `useHostBridgeOptional()` to check
 * readiness without guarding for mount order.
 */

import type { HandshakePayload, HostMethod, HostRequest, HostResponse } from '@vibe-ctl/runtime';
import { type FC, type ReactNode, createContext, useEffect, useState } from 'react';

export interface HostBridge {
  payload: HandshakePayload;
  eventPort: MessagePort;
  docSyncPort: MessagePort;
  pluginPorts: Record<string, MessagePort>;
  invoke<M extends HostMethod>(method: M, args: HostRequest<M>): Promise<HostResponse<M>>;
}

/**
 * Shape of the preload-exposed `window.__vibeCtl`. We declare this in
 * the renderer package too (the preload also declares it for its own
 * build) — the type is load-bearing in the renderer even though the
 * runtime object comes from preload.
 */
interface HandshakeCallbackArg {
  payload: HandshakePayload;
  eventPort: MessagePort;
  docSyncPort: MessagePort;
  pluginPorts: Record<string, MessagePort>;
}

interface VibeCtlWindow {
  platform: NodeJS.Platform;
  invoke<M extends HostMethod>(method: M, args: HostRequest<M>): Promise<HostResponse<M>>;
  onHostHandshake(cb: (ev: HandshakeCallbackArg) => void): () => void;
  log(level: 'debug' | 'info' | 'warn' | 'error', scope: string, msg: string, meta?: unknown): void;
}

declare global {
  interface Window {
    __vibeCtl?: VibeCtlWindow;
  }
}

/**
 * Null while handshake is pending. Consumers should go through the
 * `useHostBridge()` hook (throws if null) or `useHostBridgeOptional()`
 * (returns nullable) depending on whether the caller is inside or
 * outside the ready gate.
 */
export const HostBridgeContext = createContext<HostBridge | null>(null);

export const HostBridgeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [bridge, setBridge] = useState<HostBridge | null>(null);

  useEffect(() => {
    const api = window.__vibeCtl;
    if (!api) {
      // Tests / storybook — no preload. Bail loudly rather than deadlock.
      console.error('[host-bridge] window.__vibeCtl is missing');
      return;
    }
    const dispose = api.onHostHandshake(({ payload, eventPort, docSyncPort, pluginPorts }) => {
      setBridge({
        payload,
        eventPort,
        docSyncPort,
        pluginPorts,
        invoke: api.invoke,
      });
    });
    return dispose;
  }, []);

  return <HostBridgeContext.Provider value={bridge}>{children}</HostBridgeContext.Provider>;
};

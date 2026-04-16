/**
 * HostBridgeProvider — renderer-side boot synchronisation (spec 05 §5, §9.1).
 *
 * On mount, subscribes to `window.__vibeCtl.onHostHandshake(…)` and
 * stashes the payload + ports. Children block on `ready` until the
 * handshake lands, which guarantees no React tree ever observes a
 * half-initialised bridge.
 *
 * Placing this provider outermost (just inside `<LogProvider>` when
 * that lands in Phase 2) means the theme / i18n / screen-state
 * providers below can freely call `useHostInvoke()` without guarding
 * for `undefined`.
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
 * `useHostBridge()` hook which narrows on ready.
 */
export const HostBridgeContext = createContext<HostBridge | null>(null);

export const HostBridgeProvider: FC<{ children: ReactNode; fallback?: ReactNode }> = ({
  children,
  fallback = null,
}) => {
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

  if (!bridge) return <>{fallback}</>;
  return <HostBridgeContext.Provider value={bridge}>{children}</HostBridgeContext.Provider>;
};

/**
 * HostBridgeProvider — renderer-side boot synchronisation (spec 05 §5, §9.1).
 *
 * Listens directly on `window` for the `'vibe-ctl:handshake-ports'`
 * message posted by the preload's `initHandshakeBridge()`. This is the
 * only way to receive real `MessagePort` instances in the renderer's
 * main world — `contextBridge` cannot transfer `MessagePort` objects
 * (they lose their prototype methods during structured clone).
 *
 * Always renders children — the provider manages state only and does
 * not participate in UI rendering. The screen-router decides what to
 * show based on bridge readiness (the `'boot'` screen state maps to
 * the handshake-pending phase).
 */

import type { HandshakePayload, HostMethod, HostRequest, HostResponse } from '@vibe-ctl/runtime';
import { createContext, type FC, type ReactNode, useEffect, useState } from 'react';

/** Channel constant matching the preload's `initHandshakeBridge()`. */
const WINDOW_CHANNEL = 'vibe-ctl:handshake-ports' as const;

export interface HostBridge {
  payload: HandshakePayload;
  eventPort: MessagePort;
  docSyncPort: MessagePort;
  pluginPorts: Record<string, MessagePort>;
  invoke<M extends HostMethod>(method: M, args: HostRequest<M>): Promise<HostResponse<M>>;
}

interface VibeCtlWindow {
  platform: NodeJS.Platform;
  invoke<M extends HostMethod>(method: M, args: HostRequest<M>): Promise<HostResponse<M>>;
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
      console.error('[host-bridge] window.__vibeCtl is missing');
      return;
    }

    // Listen directly on window for ports transferred by the preload's
    // initHandshakeBridge(). This bypasses contextBridge entirely so
    // MessagePort instances arrive with their full prototype intact.
    const onMessage = (ev: MessageEvent): void => {
      if (ev.source !== window) return;
      if (ev.data?.channel !== WINDOW_CHANNEL) return;

      const payload = ev.data.payload as HandshakePayload;
      const ports = ev.ports;
      if (ports.length < 2) return;

      const [eventPort, docSyncPort, ...rest] = ports;
      if (!eventPort || !docSyncPort) return;

      const pluginPorts: Record<string, MessagePort> = {};
      if (payload.pluginRpcOrder) {
        payload.pluginRpcOrder.forEach((id: string, i: number) => {
          const port = rest[i];
          if (port) pluginPorts[id] = port;
        });
      }

      setBridge({
        payload,
        eventPort,
        docSyncPort,
        pluginPorts,
        invoke: api.invoke,
      });
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return <HostBridgeContext.Provider value={bridge}>{children}</HostBridgeContext.Provider>;
};

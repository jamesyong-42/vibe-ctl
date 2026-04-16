/**
 * Renderer handshake receiver (spec 05 §5.1, §6.2).
 *
 * Main delivers the handshake via
 *   webContents.postMessage('vibe-ctl:handshake', payload, [...ports])
 * which surfaces in the preload as a one-shot `ipcRenderer.on` event
 * whose `event.ports` carries the transferred MessagePorts.
 *
 * We split the port list back into its role slots using
 * `HandshakePayload.pluginRpcOrder`. Phase 1 ships with an empty
 * `pluginPorts` record — Phase 6 starts populating it.
 */

import type { HandshakePayload } from '@vibe-ctl/runtime';
import { ipcRenderer } from 'electron';

const HANDSHAKE_CHANNEL = 'vibe-ctl:handshake' as const;

export interface HandshakeEvent {
  payload: HandshakePayload;
  eventPort: MessagePort;
  docSyncPort: MessagePort;
  pluginPorts: Record<string, MessagePort>;
}

export type HandshakeCallback = (event: HandshakeEvent) => void;

/**
 * Register a one-shot handshake callback. Returns a disposer that
 * removes the underlying IPC listener — useful in StrictMode where
 * effects mount twice.
 */
export function onHostHandshake(cb: HandshakeCallback): () => void {
  const listener = (event: Electron.IpcRendererEvent, rawPayload: unknown): void => {
    const payload = rawPayload as HandshakePayload;
    const ports = event.ports;
    if (ports.length < 2) {
      // Malformed; drop silently but keep the listener so a later
      // well-formed message still lands.
      return;
    }
    const [eventPort, docSyncPort, ...rest] = ports;
    if (!eventPort || !docSyncPort) return;
    const pluginPorts: Record<string, MessagePort> = {};
    payload.pluginRpcOrder.forEach((id, i) => {
      const port = rest[i];
      if (port) pluginPorts[id] = port;
    });
    cb({ payload, eventPort, docSyncPort, pluginPorts });
  };
  ipcRenderer.on(HANDSHAKE_CHANNEL, listener);
  return () => {
    ipcRenderer.removeListener(HANDSHAKE_CHANNEL, listener);
  };
}

/**
 * Renderer handshake receiver (spec 05 §5.1, §6.2).
 *
 * Main delivers the handshake via
 *   webContents.postMessage('vibe-ctl:handshake', payload, [...ports])
 * which surfaces in the preload as a one-shot `ipcRenderer.on` event
 * whose `event.ports` carries the transferred MessagePorts.
 *
 * **Critical**: `contextBridge` cannot transfer `MessagePort` objects
 * across the isolation boundary — they lose their methods and become
 * plain objects. We use `window.postMessage` with `transfer` to hand
 * ports to the renderer's main world instead. The renderer listens
 * for a `'vibe-ctl:handshake-ports'` message on `window`.
 *
 * We split the port list back into its role slots using
 * `HandshakePayload.pluginRpcOrder`. Phase 1 ships with an empty
 * `pluginPorts` record — Phase 6 starts populating it.
 */

import type { HandshakePayload } from '@vibe-ctl/runtime';
import { ipcRenderer } from 'electron';

const HANDSHAKE_CHANNEL = 'vibe-ctl:handshake' as const;
const WINDOW_CHANNEL = 'vibe-ctl:handshake-ports' as const;

export interface HandshakeEvent {
  payload: HandshakePayload;
  eventPort: MessagePort;
  docSyncPort: MessagePort;
  pluginPorts: Record<string, MessagePort>;
}

export type HandshakeCallback = (event: HandshakeEvent) => void;

/**
 * Register a one-shot handshake callback. The preload receives ports
 * via IPC, then re-transfers them into the renderer's main world via
 * `window.postMessage` (the only way to move MessagePorts across
 * contextIsolation). The callback registered here listens on `window`
 * for the re-posted message.
 *
 * Returns a disposer — useful in StrictMode where effects mount twice.
 */
export function onHostHandshake(cb: HandshakeCallback): () => void {
  const windowListener = (ev: MessageEvent): void => {
    if (ev.source !== window || ev.data?.channel !== WINDOW_CHANNEL) return;
    const payload = ev.data.payload as HandshakePayload;
    const ports = ev.ports;
    if (ports.length < 2) return;
    const [eventPort, docSyncPort, ...rest] = ports;
    if (!eventPort || !docSyncPort) return;
    const pluginPorts: Record<string, MessagePort> = {};
    payload.pluginRpcOrder.forEach((id: string, i: number) => {
      const port = rest[i];
      if (port) pluginPorts[id] = port;
    });
    cb({ payload, eventPort, docSyncPort, pluginPorts });
  };
  window.addEventListener('message', windowListener);
  return () => {
    window.removeEventListener('message', windowListener);
  };
}

/**
 * Called from the preload entry to wire the IPC → window.postMessage
 * bridge. This runs in the preload's isolated world where `ipcRenderer`
 * and MessagePorts are both accessible.
 */
export function initHandshakeBridge(): void {
  ipcRenderer.on(HANDSHAKE_CHANNEL, (event: Electron.IpcRendererEvent, rawPayload: unknown) => {
    const ports = event.ports;
    if (ports.length < 2) return;
    window.postMessage({ channel: WINDOW_CHANNEL, payload: rawPayload }, '*', [...ports]);
  });
}

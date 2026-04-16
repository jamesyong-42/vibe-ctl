/**
 * Renderer handshake delivery (spec 05 §5.1, §6.2).
 *
 * `webContents.postMessage(channel, payload, [port1, port2, …])`
 * transfers MessagePorts into the renderer. The preload listens on
 * the same channel via `ipcRenderer.on(channel, (event, payload) => { event.ports })`
 * and surfaces them to the renderer process through `__vibeCtl.onHostHandshake`.
 *
 * The port order in the transfer list is load-bearing: the receiver
 * splits them back into `{ eventPort, docSyncPort, pluginPorts[...] }`
 * using `HandshakePayload.pluginRpcOrder`.
 */

import { HandshakeChannel, type HandshakePayload } from '@vibe-ctl/runtime';
import type { BrowserWindow } from 'electron';
import type { HandshakePorts } from './broker.js';

export function sendHandshake(
  win: BrowserWindow,
  payload: HandshakePayload,
  ports: HandshakePorts,
): void {
  const pluginRpcOrder = payload.pluginRpcOrder;
  const transfer = [
    ports.event.remote,
    ports.docSync.remote,
    ...pluginRpcOrder.map((id) => {
      const pair = ports.plugins[id];
      if (!pair) {
        throw new Error(`handshake: missing plugin port for '${id}'`);
      }
      return pair.remote;
    }),
  ];
  win.webContents.postMessage(HandshakeChannel, payload, transfer);
}

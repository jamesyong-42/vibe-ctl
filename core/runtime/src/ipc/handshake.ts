/**
 * Renderer handshake payload (spec 05 §5.1, §6.2).
 *
 * The handshake is delivered via
 *   webContents.postMessage(channel, payload, [port1, port2, …])
 *
 * The `payload` argument carries JSON metadata only; the MessagePorts
 * themselves are transferred in the third argument. The preload's
 * handshake receiver pairs them back up when forwarding to the
 * renderer's `__vibeCtl.onHostHandshake` callback.
 */

/** IPC channel name for the renderer handshake. */
export const HandshakeChannel = 'vibe-ctl:handshake' as const;
export type HandshakeChannel = typeof HandshakeChannel;

export interface HandshakePayload {
  /** Stable per-device UUID from `config/device-identity.json`. */
  deviceId: string;
  /** Human-readable device name (OS hostname fallback). */
  deviceName: string;
  /** Kernel utility version (== app version today). */
  kernelVersion: string;
  /**
   * Plugin ids whose RPC ports are transferred alongside this payload,
   * in the same order as the transferred `MessagePort` list. Used by
   * preload to reconstruct the `pluginPorts: Record<string, MessagePort>`
   * map for the renderer.
   */
  pluginRpcOrder: string[];
}

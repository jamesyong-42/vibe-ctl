/**
 * `__vibeCtl` bridge definition (spec 05 §5.1).
 *
 * The preload exposes exactly this object via `contextBridge`. Nothing
 * else crosses into the renderer's world — no `ipcRenderer`, no
 * `process`, no `require`.
 */

import type { HandshakeCallback } from './handshake.js';
import { onHostHandshake } from './handshake.js';
import { invoke } from './invoke.js';
import { type LogLevel, log } from './log.js';

export interface VibeCtlBridge {
  platform: NodeJS.Platform;
  invoke: typeof invoke;
  onHostHandshake(cb: HandshakeCallback): () => void;
  log(level: LogLevel, scope: string, msg: string, meta?: unknown): void;
}

export function buildBridge(): VibeCtlBridge {
  return {
    platform: process.platform,
    invoke,
    onHostHandshake,
    log,
  };
}

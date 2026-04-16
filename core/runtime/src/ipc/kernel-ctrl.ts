/**
 * Main ↔ kernel-utility control Comlink interface (spec 05 §6.4).
 *
 * The ctrl port is a single MessagePort pair established at
 * `utilityProcess.fork()` time. Main drives lifecycle; the kernel
 * utility responds. Tiny surface by design.
 */

import type { EventPortMessage } from './events.js';

/** Lightweight peer descriptor for the mesh status UI. */
export interface Peer {
  id: string;
  deviceName: string;
}

export type KernelHealth = 'ok' | 'degraded' | 'offline';

/**
 * Callback registered by main to receive events emitted by the kernel
 * utility (e.g. `mesh.auth.required`). Main forwards each event out to
 * connected renderer event ports, keeping main as the sole broker per
 * spec 05 §2. The callback is invoked over Comlink — do not return
 * anything meaningful from it.
 */
export type KernelEventCallback = (msg: EventPortMessage) => void;

export interface KernelCtrl {
  /** Version string of the kernel utility binary (semver). */
  getVersion(): Promise<string>;
  /** Current mesh peer list. Empty before `start()` resolves. */
  getPeers(): Promise<Peer[]>;
  /** Rollup health signal surfaced in the tray + version-gate screen. */
  health(): Promise<KernelHealth>;
  /** Open NapiNode, load snapshots, join mesh. Idempotent. */
  start(): Promise<void>;
  /** Graceful shutdown: leave mesh, flush snapshots, close Loro replicas. */
  stop(): Promise<void>;
  /**
   * Register a callback for events emitted by the kernel utility. Main
   * uses this to forward utility-originated VibeEvents onto the per-
   * renderer event port. Only one subscriber at a time — a later call
   * replaces the earlier callback.
   */
  onEvent(cb: KernelEventCallback): Promise<void>;
}

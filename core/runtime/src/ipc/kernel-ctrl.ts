/**
 * Main ↔ kernel-utility control Comlink interface (spec 05 §6.4).
 *
 * The ctrl port is a single MessagePort pair established at
 * `utilityProcess.fork()` time. Main drives lifecycle; the kernel
 * utility responds. Tiny surface by design.
 */

/** Lightweight peer descriptor for the mesh status UI. */
export interface Peer {
  id: string;
  deviceName: string;
}

export type KernelHealth = 'ok' | 'degraded' | 'offline';

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
}

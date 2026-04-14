/**
 * Kernel version gate. Spec 02 §4.1 + §10 step 4.
 *
 * Reads peers' most-recently-seen `minKernelVersion` from the
 * `kernel/version-beacons` SyncedStore slice. If this kernel's version is
 * below any peer's minimum, signals the shell to show a blocking
 * "Update required" screen and abort the rest of boot.
 *
 * Decision (spec 02 decisions, 1st bullet): version beacons live in a
 * dedicated SyncedStore slice, not in per-doc metadata — so the boot
 * check is a single slice read.
 */

import type { NapiNode } from '@vibecook/truffle';

export interface VersionGateResult {
  /** True if this kernel meets every peer's minimum. */
  ok: boolean;
  /** Kernel version of this app. */
  self: string;
  /** Peer-reported minimum kernel versions; empty map if no peers seen. */
  peerMinimums: Map<string, string>;
  /** If not ok, the highest minimum among peers. */
  required?: string;
}

export interface VersionGateOptions {
  node: NapiNode | null;
  kernelVersion: string;
  /**
   * How long to wait for the version-beacons slice to deliver at least one
   * peer sample. If no peers show up inside this budget we pass through.
   * (Fresh installs, offline first run.)
   */
  waitMs?: number;
}

/**
 * Opens (or lazily creates) `kernel/version-beacons`, publishes our own
 * beacon, waits briefly for peers, and returns a verdict.
 */
export async function runVersionGate(_opts: VersionGateOptions): Promise<VersionGateResult> {
  throw new Error('not implemented: runVersionGate');
}

/**
 * Publishes this kernel's version to the beacon slice. Called each boot
 * AFTER the gate passes (we don't want to advertise a too-old kernel).
 */
export async function publishVersionBeacon(_opts: {
  node: NapiNode | null;
  kernelVersion: string;
  minKernelVersion: string;
}): Promise<void> {
  throw new Error('not implemented: publishVersionBeacon');
}

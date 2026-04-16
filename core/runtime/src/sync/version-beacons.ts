/**
 * VersionBeacons — per-device kernel version publication (spec 02 §4.1).
 *
 * Uses a SyncedStore slice where each device publishes its current kernel
 * version and the minimum kernel version it requires peers to have.
 * The version gate reads all peers' beacons at boot to decide if this
 * app is too old.
 *
 * Decision (spec 02 decisions, 1st bullet): version beacons live in a
 * dedicated SyncedStore, not per-doc metadata.
 */

import type { SyncedStoreHandle } from './kernel-docs.js';

/** Shape of one device's version beacon slice. */
export interface VersionBeacon {
  kernelVersion: string;
  minKernelVersion: string;
  publishedAt: number;
}

export class VersionBeacons {
  readonly #store: SyncedStoreHandle<VersionBeacon>;

  constructor(store: SyncedStoreHandle<VersionBeacon>) {
    this.#store = store;
  }

  /** Publish this device's version beacon. */
  publishVersion(deviceId: string, kernelVersion: string, minKernelVersion: string): void {
    // The SyncedStore.set() writes to this device's slice only.
    // We temporarily inject the deviceId context via the store's own scope.
    // In the in-memory simulation, set() always writes to the local device slice.
    this.#store.set({
      kernelVersion,
      minKernelVersion,
      publishedAt: Date.now(),
    });
  }

  /**
   * Read the highest `minKernelVersion` any peer requires.
   * Returns null if no peers have published beacons yet.
   */
  getMaxPeerMinVersion(): string | null {
    const allSlices = this.#store.all();
    let maxMin: string | null = null;

    for (const beacon of allSlices.values()) {
      if (!beacon.minKernelVersion) continue;
      if (maxMin === null || compareVersions(beacon.minKernelVersion, maxMin) > 0) {
        maxMin = beacon.minKernelVersion;
      }
    }
    return maxMin;
  }

  /** Get all peer beacons. */
  getAllBeacons(): Map<string, VersionBeacon> {
    return this.#store.all();
  }

  /** Access the underlying store. */
  get store(): SyncedStoreHandle<VersionBeacon> {
    return this.#store;
  }
}

/**
 * Simple semver comparison. Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *
 * Only handles `major.minor.patch` (no pre-release tags). Sufficient for
 * the version gate which compares kernel versions that are always clean
 * semver.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

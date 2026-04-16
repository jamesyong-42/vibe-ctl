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

import { createScopedLogger } from '../logging/index.js';
import type { VersionBeacons } from './version-beacons.js';

const log = createScopedLogger('sync:version-gate');

export interface VersionGateResult {
  /** 'ok' if this kernel meets every peer's minimum. */
  status: 'ok' | 'outdated';
  /** Kernel version of this app. */
  self: string;
  /** Peer-reported minimum kernel versions; empty map if no peers seen. */
  peerMinimums: Map<string, string>;
  /** If outdated, the highest minimum among peers. */
  required?: string;
}

export interface VersionGateOptions {
  beacons: VersionBeacons;
  kernelVersion: string;
  /**
   * How long to wait for the version-beacons slice to deliver at least one
   * peer sample. If no peers show up inside this budget we pass through.
   * (Fresh installs, offline first run.)
   */
  waitMs?: number;
}

/**
 * Compare local kernel version against peer minimums.
 * Returns `'ok'` or `'outdated'`.
 */
export function checkVersionGate(opts: VersionGateOptions): VersionGateResult {
  const { beacons, kernelVersion } = opts;
  const allBeacons = beacons.getAllBeacons();

  const peerMinimums = new Map<string, string>();
  for (const [deviceId, beacon] of allBeacons) {
    if (beacon.minKernelVersion) {
      peerMinimums.set(deviceId, beacon.minKernelVersion);
    }
  }

  const maxPeerMin = beacons.getMaxPeerMinVersion();
  if (!maxPeerMin) {
    log.debug('no peer minimums found — passing version gate');
    return { status: 'ok', self: kernelVersion, peerMinimums };
  }

  const cmp = compareVersions(kernelVersion, maxPeerMin);
  if (cmp < 0) {
    log.warn(
      { self: kernelVersion, required: maxPeerMin },
      'kernel version is behind peer minimum — gate BLOCKED',
    );
    return { status: 'outdated', self: kernelVersion, peerMinimums, required: maxPeerMin };
  }

  log.debug({ self: kernelVersion, maxPeerMin }, 'version gate passed');
  return { status: 'ok', self: kernelVersion, peerMinimums };
}

/**
 * Publishes this kernel's version to the beacon slice. Called each boot
 * AFTER the gate passes (we don't want to advertise a too-old kernel).
 */
export function publishVersionBeacon(
  beacons: VersionBeacons,
  deviceId: string,
  kernelVersion: string,
  minKernelVersion: string,
): void {
  beacons.publishVersion(deviceId, kernelVersion, minKernelVersion);
  log.info({ deviceId, kernelVersion, minKernelVersion }, 'version beacon published');
}

/**
 * Simple semver comparison for clean `major.minor.patch` strings.
 * Returns -1, 0, or 1.
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

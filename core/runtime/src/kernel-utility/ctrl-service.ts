/**
 * Phase-1 stub implementation of the `KernelCtrl` Comlink service
 * (spec 05 §6.4). The real sync fabric + mesh wiring lands in Phase 4;
 * this factory exists so main can call `getVersion()` and prove the
 * ctrl port round-trips.
 */

import type { KernelCtrl } from '../ipc/kernel-ctrl.js';

const KERNEL_UTILITY_VERSION = '0.0.0-phase1';

export function createCtrlService(): KernelCtrl {
  return {
    async getVersion() {
      return KERNEL_UTILITY_VERSION;
    },
    async getPeers() {
      return [];
    },
    async health() {
      return 'ok';
    },
    async start() {
      // Phase-1: no-op. NapiNode + Loro snapshots land in Phase 4.
    },
    async stop() {
      // Phase-1: no-op. Graceful drain lands alongside Phase 4.
    },
  };
}

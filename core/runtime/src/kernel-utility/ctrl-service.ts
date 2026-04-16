/**
 * `KernelCtrl` Comlink service (spec 05 §6.4).
 *
 * When the sync stack is booted, delegates to the real MeshNode and
 * truffle health APIs. Before boot completes, returns safe defaults.
 */

import type { KernelCtrl, KernelHealth, Peer } from '../ipc/kernel-ctrl.js';
import type { DocAuthority } from '../sync/doc-authority.js';
import type { KernelDocs } from '../sync/kernel-docs.js';
import type { MeshNode } from '../sync/mesh-node.js';
import type { DocRouter } from './doc-router.js';
import type { DocPersistence } from './persistence.js';

const KERNEL_UTILITY_VERSION = '0.1.0';

interface SyncStack {
  meshNode: MeshNode;
  docs: KernelDocs;
  authority: DocAuthority;
  persistence: DocPersistence;
  docRouter: DocRouter;
  truffleAvailable: boolean;
}

export interface CtrlServiceOptions {
  getStack: () => SyncStack | null;
  bootPromise: Promise<void>;
}

export function createCtrlService(opts: CtrlServiceOptions): KernelCtrl {
  const { getStack, bootPromise } = opts;

  return {
    async getVersion() {
      return KERNEL_UTILITY_VERSION;
    },

    async getPeers(): Promise<Peer[]> {
      const stack = getStack();
      if (!stack) return [];
      return stack.meshNode.getPeers();
    },

    async health(): Promise<KernelHealth> {
      const stack = getStack();
      if (!stack) return 'offline';
      if (!stack.meshNode.hasNode) return 'offline';
      const h = await stack.meshNode.health();
      if (!h) return 'offline';
      if (h.healthy) return 'ok';
      return 'degraded';
    },

    async start() {
      // The sync stack boots asynchronously in entry.ts. This call
      // ensures the caller can await boot completion.
      await bootPromise;
    },

    async stop() {
      // Graceful shutdown is handled by onShutdown in entry.ts.
      // This is a no-op signal; actual drain happens on process exit.
    },
  };
}

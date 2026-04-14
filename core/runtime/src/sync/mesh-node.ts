/**
 * MeshNode — owner of the single truffle `NapiNode`.
 *
 * Invariant (spec 02 §11.1): exactly one NapiNode per app. This class
 * constructs it on start, joins the tailnet, and exposes it to sibling
 * kernel modules (KernelDocs, plugin MeshAPI façade). Nothing else
 * should reach for truffle's C bindings directly.
 *
 * Concrete truffle types are host-provided singletons; we only need the
 * type at build time.
 */

import type { Logger } from '@vibe-ctl/extension-api';
import type { NapiNode } from '@vibecook/truffle';

export interface MeshNodeOptions {
  deviceId: string;
  deviceName: string;
  logger: Logger;
  /** If true, do not start the NapiNode at all. Used by offline mode. */
  offline?: boolean;
}

export class MeshNode {
  readonly #opts: MeshNodeOptions;
  #node: NapiNode | null = null;

  constructor(opts: MeshNodeOptions) {
    this.#opts = opts;
  }

  /** Lazily constructs + starts the NapiNode. Idempotent. */
  async start(): Promise<void> {
    if (this.#opts.offline) {
      this.#opts.logger.info('mesh: offline mode — skipping NapiNode start');
      return;
    }
    if (this.#node) return;
    throw new Error('not implemented: MeshNode.start (construct NapiNode, join tailnet)');
  }

  /**
   * Hard shutdown. Flush outstanding CRDT/SyncedStore deltas before calling —
   * spec 02 §10 step 10.
   */
  async stop(): Promise<void> {
    if (!this.#node) return;
    throw new Error('not implemented: MeshNode.stop');
  }

  /** The underlying NapiNode, or null when offline / not started. */
  get node(): NapiNode | null {
    return this.#node;
  }
}

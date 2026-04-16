/**
 * DocAuthority — holds the authoritative Loro replicas for all four kernel docs
 * (spec 05 §2.1, §6.4).
 *
 * Lives in the kernel utility process. Receives deltas from renderers (via
 * doc-sync ports) and from mesh peers (via MeshNode). Fans out to all
 * subscribed renderer ports and to peers.
 */

import type { Disposable } from '@vibe-ctl/plugin-api';
import type { DocSyncMessage } from '../ipc/doc-sync.js';
import { createScopedLogger } from '../logging/index.js';
import type { KernelDocName, KernelDocs } from './kernel-docs.js';
import type { MeshNode } from './mesh-node.js';

const log = createScopedLogger('sync:doc-authority');

/** Port-like interface for renderer connections (MessagePort shape). */
export interface RendererPort {
  postMessage(msg: DocSyncMessage, transfer?: unknown[]): void;
}

export interface DocAuthorityOptions {
  docs: KernelDocs;
  mesh: MeshNode;
}

type DeltaListener = (delta: Uint8Array) => void;

export class DocAuthority {
  readonly #docs: KernelDocs;
  readonly #mesh: MeshNode;
  /** Per-doc set of renderer ports subscribed to deltas. */
  readonly #rendererPorts = new Map<KernelDocName, Set<RendererPort>>();
  /** Per-doc listeners for internal subscribers. */
  readonly #listeners = new Map<KernelDocName, Set<DeltaListener>>();

  constructor(opts: DocAuthorityOptions) {
    this.#docs = opts.docs;
    this.#mesh = opts.mesh;
  }

  /**
   * Apply an incoming delta (from a renderer or peer) to the authoritative
   * doc. After applying, fans out to other renderers and peers.
   */
  applyDelta(docName: KernelDocName, delta: Uint8Array, source?: RendererPort): void {
    const doc = this.#docs.getDoc(docName);
    doc.applyDelta(delta);

    // Fan out to renderers (excluding the source that sent the delta).
    this.broadcastToRenderers(docName, delta, source);

    // Fan out to mesh peers.
    this.broadcastToPeers(docName, delta);

    // Notify internal subscribers.
    const docListeners = this.#listeners.get(docName);
    if (docListeners) {
      for (const cb of docListeners) {
        try {
          cb(delta);
        } catch (err) {
          log.warn({ err: String(err), docName }, 'delta listener threw');
        }
      }
    }
  }

  /**
   * Subscribe to delta notifications for a given doc. Called when local or
   * peer edits produce deltas.
   */
  subscribe(docName: KernelDocName, cb: DeltaListener): Disposable {
    let set = this.#listeners.get(docName);
    if (!set) {
      set = new Set();
      this.#listeners.set(docName, set);
    }
    set.add(cb);
    return {
      [Symbol.dispose]() {
        set.delete(cb);
      },
    };
  }

  /**
   * Fan out a delta to all subscribed renderer ports for a given doc,
   * optionally excluding the source port (to prevent echo).
   */
  broadcastToRenderers(docName: KernelDocName, delta: Uint8Array, exclude?: RendererPort): void {
    const ports = this.#rendererPorts.get(docName);
    if (!ports) return;
    const msg: DocSyncMessage = { type: 'delta', docName, payload: delta };
    for (const port of ports) {
      if (port === exclude) continue;
      try {
        port.postMessage(msg);
      } catch (err) {
        log.warn({ err: String(err), docName }, 'failed to post delta to renderer');
      }
    }
  }

  /** Send a delta to mesh peers via MeshNode. */
  broadcastToPeers(docName: KernelDocName, delta: Uint8Array): void {
    if (!this.#mesh.hasNode) return;
    this.#mesh.broadcast(`doc:${docName}`, delta);
  }

  /** Register a renderer port to receive deltas for a doc. */
  addRendererPort(docName: KernelDocName, port: RendererPort): void {
    let set = this.#rendererPorts.get(docName);
    if (!set) {
      set = new Set();
      this.#rendererPorts.set(docName, set);
    }
    set.add(port);
  }

  /** Remove a renderer port. */
  removeRendererPort(docName: KernelDocName, port: RendererPort): void {
    this.#rendererPorts.get(docName)?.delete(port);
  }

  /** Remove a renderer port from all docs. */
  removeRendererPortAll(port: RendererPort): void {
    for (const set of this.#rendererPorts.values()) {
      set.delete(port);
    }
  }

  /** Access the underlying KernelDocs. */
  get docs(): KernelDocs {
    return this.#docs;
  }
}

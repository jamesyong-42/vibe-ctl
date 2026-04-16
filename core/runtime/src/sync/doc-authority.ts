/**
 * DocAuthority — holds the authoritative Loro replicas for all four kernel docs
 * (spec 05 §2.1, §6.4).
 *
 * Lives in the kernel utility process. Receives deltas from renderers (via
 * doc-sync ports) and fans out to all subscribed renderer ports.
 *
 * Peer-to-peer sync: when truffle is wired, the NapiCrdtDoc instances handle
 * peer discovery and Loro delta exchange automatically via truffle's internal
 * gossip protocol. DocAuthority only manages the utility↔renderer channel.
 * When truffle is NOT wired (in-memory fallback), DocAuthority also fans out
 * to mesh peers via MeshNode.broadcast().
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
   * Apply an incoming delta (from a renderer) to the authoritative doc.
   * After applying, fans out to other renderers.
   *
   * When truffle is wired, peer-to-peer propagation is handled by
   * NapiCrdtDoc's built-in sync — we only broadcast to peers when
   * running in fallback (in-memory) mode.
   */
  applyDelta(docName: KernelDocName, delta: Uint8Array, source?: RendererPort): void {
    const doc = this.#docs.getDoc(docName);
    doc.applyDelta(delta);

    // Fan out to renderers (excluding the source that sent the delta).
    this.broadcastToRenderers(docName, delta, source);

    // Fan out to mesh peers only when NOT truffle-backed. Truffle handles
    // its own peer gossip via the NapiCrdtDoc's internal Loro sync.
    if (!this.#docs.isTruffleBacked) {
      this.broadcastToPeers(docName, delta);
    }

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
   *
   * The payload is opaque binary — when truffle is wired it's Loro binary
   * deltas; when in fallback mode it's JSON-encoded ops. Renderers handle
   * both formats via their KernelDocProvider.
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

  /**
   * Send a delta to mesh peers via MeshNode (fallback mode only).
   * When truffle is wired, peer sync is handled internally by NapiCrdtDoc.
   */
  broadcastToPeers(docName: KernelDocName, delta: Uint8Array): void {
    if (!this.#mesh.hasNode) return;
    this.#mesh.broadcast(`doc:${docName}`, delta);
  }

  /**
   * Wire up mesh peer→authority delta reception (fallback mode only).
   * Subscribes to incoming mesh messages for each kernel doc namespace
   * and applies them to the authoritative replica.
   */
  subscribeToPeerDeltas(): Disposable[] {
    if (this.#docs.isTruffleBacked) {
      // Truffle handles peer sync internally — no mesh subscription needed.
      return [];
    }

    const disposables: Disposable[] = [];
    const docNames: KernelDocName[] = [
      'kernel/plugin-inventory',
      'kernel/canvas-layout',
      'kernel/user-settings',
      'kernel/permissions',
    ];
    for (const docName of docNames) {
      const d = this.#mesh.subscribe(`doc:${docName}`, (msg) => {
        const doc = this.#docs.getDoc(docName);
        doc.applyDelta(msg.data);
        // Fan out to renderers (this came from a peer, not a renderer).
        this.broadcastToRenderers(docName, msg.data);
      });
      disposables.push(d);
    }
    return disposables;
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

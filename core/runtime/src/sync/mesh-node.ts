/**
 * MeshNode — kernel-friendly wrapper around truffle's NapiNode (spec 02 §3, §11.1).
 *
 * Runs inside the kernel utility process. Owns the single NapiNode instance,
 * peer discovery, and namespace-scoped messaging. Plugins never touch this
 * directly — they go through `ctx.mesh` which delegates to here with
 * auto-namespacing.
 *
 * Invariant (spec 02 §11.1): exactly one NapiNode per app. This class
 * constructs it on start, joins the tailnet, and exposes it to sibling
 * kernel modules (KernelDocs, DocAuthority, plugin MeshAPI facade). Nothing
 * else should reach for truffle's C bindings directly.
 *
 * When truffle is available, all methods delegate to the real NapiNode.
 * When truffle is absent (CI, tests), a no-op fallback keeps the app
 * functional in offline mode.
 */

import type { Disposable, Logger } from '@vibe-ctl/plugin-api';
import type {
  TruffleCrdtDoc,
  TruffleHealthInfo,
  TruffleNapiNode,
  TrufflePeer,
  TrufflePeerEvent,
  TruffleSyncedStore,
} from './truffle-types.js';

// ─── Public types ───────────────────────────────────────────────────────────

/** Lightweight peer descriptor. Matches `ipc/kernel-ctrl.ts` Peer. */
export interface Peer {
  id: string;
  deviceName: string;
}

export type PeerChangeEvent = { type: 'joined' | 'left'; peer: Peer };

// ─── Construction options ───────────────────────────────────────────────────

export interface MeshNodeOptions {
  deviceId: string;
  deviceName: string;
  logger: Logger;
  /** If true, do not start the NapiNode at all. Used by offline mode. */
  offline?: boolean;
  /**
   * Optional pre-built truffle NapiNode. When provided, MeshNode wraps it
   * directly. When absent, mesh operations are no-ops (offline / truffle not
   * available).
   */
  truffleNode?: TruffleNapiNode;
}

// ─── MeshNode ───────────────────────────────────────────────────────────────

export class MeshNode {
  readonly #opts: MeshNodeOptions;
  readonly #log: Logger;
  readonly #node: TruffleNapiNode | null;
  #started = false;

  constructor(opts: MeshNodeOptions) {
    this.#opts = opts;
    this.#log = opts.logger;
    this.#node = opts.truffleNode ?? null;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Starts the NapiNode, joins the tailnet. Idempotent. */
  async start(): Promise<void> {
    if (this.#started) return;
    if (this.#opts.offline || !this.#node) {
      this.#log.info('mesh: offline mode or no truffle node — mesh disabled');
      this.#started = true;
      return;
    }
    // NapiNode.start() is called externally before passing to MeshNode, or
    // the node is already started via createMeshNode(). Mark as started.
    this.#log.info(
      { deviceId: this.#opts.deviceId, deviceName: this.#opts.deviceName },
      'mesh started',
    );
    this.#started = true;
  }

  /**
   * Hard shutdown. Flush outstanding CRDT/SyncedStore deltas before calling —
   * spec 02 §10 step 10.
   */
  async stop(): Promise<void> {
    if (!this.#started) return;
    if (this.#node && !this.#opts.offline) {
      await this.#node.stop();
      this.#log.info('mesh stopped');
    }
    this.#started = false;
  }

  // ─── Peer queries ─────────────────────────────────────────────────────

  async getPeers(): Promise<Peer[]> {
    if (!this.#node) return [];
    const peers = await this.#node.getPeers();
    return peers.map((p: TrufflePeer) => ({ id: p.deviceId, deviceName: p.deviceName }));
  }

  /**
   * Subscribe to peer change events from the real NapiNode.
   * Maps truffle's `NapiPeerEvent` to our simplified `PeerChangeEvent`.
   */
  onPeerChange(cb: (event: PeerChangeEvent) => void): Disposable {
    if (!this.#node) {
      return { [Symbol.dispose]() {} };
    }
    this.#node.onPeerChange((event: TrufflePeerEvent) => {
      if (event.eventType === 'joined' && event.peer) {
        cb({
          type: 'joined',
          peer: { id: event.peer.deviceId, deviceName: event.peer.deviceName },
        });
      } else if (event.eventType === 'left') {
        cb({
          type: 'left',
          peer: { id: event.peerId, deviceName: '' },
        });
      }
    });
    // NapiNode.onPeerChange doesn't return a disposable — it's a permanent
    // subscription for the lifetime of the node. Return a no-op disposable.
    return { [Symbol.dispose]() {} };
  }

  // ─── Messaging ────────────────────────────────────────────────────────

  broadcast(namespace: string, data: Uint8Array): void {
    if (!this.#node) return;
    void this.#node.broadcast(namespace, Buffer.from(data));
  }

  send(peerId: string, namespace: string, data: Uint8Array): void {
    if (!this.#node) return;
    void this.#node.send(peerId, namespace, Buffer.from(data));
  }

  subscribe(
    namespace: string,
    handler: (msg: { peerId: string; namespace: string; data: Uint8Array }) => void,
  ): Disposable {
    if (!this.#node) {
      return { [Symbol.dispose]() {} };
    }
    this.#node.onMessage(namespace, (msg) => {
      handler({
        peerId: msg.from,
        namespace: msg.namespace,
        data: msg.payload instanceof Uint8Array ? msg.payload : new Uint8Array(0),
      });
    });
    return { [Symbol.dispose]() {} };
  }

  // ─── CRDT doc / SyncedStore access ────────────────────────────────────

  /**
   * Open a CrdtDoc via the underlying NapiNode. Returns null if the node
   * is not available.
   */
  getCrdtDoc(docId: string): TruffleCrdtDoc | null {
    if (!this.#node) return null;
    return this.#node.crdtDoc(docId);
  }

  /**
   * Open a SyncedStore via the underlying NapiNode. Returns null if the
   * node is not available.
   */
  getSyncedStore(storeId: string): TruffleSyncedStore | null {
    if (!this.#node) return null;
    return this.#node.syncedStore(storeId);
  }

  // ─── Health ───────────────────────────────────────────────────────────

  /**
   * Query truffle's network health. Returns null when offline.
   */
  async health(): Promise<TruffleHealthInfo | null> {
    if (!this.#node) return null;
    return this.#node.health();
  }

  // ─── Introspection ────────────────────────────────────────────────────

  get deviceId(): string {
    return this.#opts.deviceId;
  }

  get deviceName(): string {
    return this.#opts.deviceName;
  }

  get isStarted(): boolean {
    return this.#started;
  }

  /** The underlying NapiNode, or null when offline / not started. */
  get node(): TruffleNapiNode | null {
    return this.#node;
  }

  get hasNode(): boolean {
    return this.#node !== null;
  }
}

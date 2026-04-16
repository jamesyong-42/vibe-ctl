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
 */

import type { Disposable, Logger } from '@vibe-ctl/plugin-api';

// ─── Truffle type stubs ──────────────────────────────────────────────────────
// TODO: replace with @vibecook/truffle imports when available

/** Lightweight peer descriptor. Matches `ipc/kernel-ctrl.ts` Peer. */
export interface Peer {
  id: string;
  deviceName: string;
}

export type PeerChangeEvent = { type: 'joined' | 'left'; peer: Peer };

/** Minimal surface we need from truffle's NapiNode. */
export interface TruffleNode {
  start(): Promise<void>;
  stop(): Promise<void>;
  peers(): Peer[];
  onPeerChange(cb: (event: PeerChangeEvent) => void): Disposable;
  broadcast(namespace: string, data: Uint8Array): void;
  send(peerId: string, namespace: string, data: Uint8Array): void;
  subscribe(
    namespace: string,
    handler: (msg: { peerId: string; namespace: string; data: Uint8Array }) => void,
  ): Disposable;
}

// ─── Construction options ────────────────────────────────────────────────────

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
  truffleNode?: TruffleNode;
}

// ─── MeshNode ────────────────────────────────────────────────────────────────

export class MeshNode {
  readonly #opts: MeshNodeOptions;
  readonly #log: Logger;
  readonly #node: TruffleNode | null;
  #started = false;

  constructor(opts: MeshNodeOptions) {
    this.#opts = opts;
    this.#log = opts.logger;
    this.#node = opts.truffleNode ?? null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /** Starts the NapiNode, joins the tailnet. Idempotent. */
  async start(): Promise<void> {
    if (this.#started) return;
    if (this.#opts.offline || !this.#node) {
      this.#log.info('mesh: offline mode or no truffle node — mesh disabled');
      this.#started = true;
      return;
    }
    await this.#node.start();
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

  // ─── Peer queries ──────────────────────────────────────────────────────

  getPeers(): Peer[] {
    return this.#node?.peers() ?? [];
  }

  onPeerChange(cb: (event: PeerChangeEvent) => void): Disposable {
    if (!this.#node) {
      return { [Symbol.dispose]() {} };
    }
    return this.#node.onPeerChange(cb);
  }

  // ─── Messaging ─────────────────────────────────────────────────────────

  broadcast(namespace: string, data: Uint8Array): void {
    this.#node?.broadcast(namespace, data);
  }

  send(peerId: string, namespace: string, data: Uint8Array): void {
    this.#node?.send(peerId, namespace, data);
  }

  subscribe(
    namespace: string,
    handler: (msg: { peerId: string; namespace: string; data: Uint8Array }) => void,
  ): Disposable {
    if (!this.#node) {
      return { [Symbol.dispose]() {} };
    }
    return this.#node.subscribe(namespace, handler);
  }

  // ─── Introspection ─────────────────────────────────────────────────────

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
  get node(): TruffleNode | null {
    return this.#node;
  }

  get hasNode(): boolean {
    return this.#node !== null;
  }
}

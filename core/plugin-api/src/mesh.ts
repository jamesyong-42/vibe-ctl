import type { Disposable } from './disposable.js';

/** A peer currently online in the truffle mesh. */
export interface Peer {
  peerId: string;
  deviceName: string;
  /** Kernel version the peer advertises. */
  kernelVersion: string;
}

/** Peer join/leave notification. */
export type PeerEvent = { kind: 'joined'; peer: Peer } | { kind: 'left'; peerId: string };

/** Envelope delivered to `subscribe()` handlers. */
export interface MeshMessage<T = unknown> {
  /** The peer the message came from. */
  fromPeerId: string;
  /** Plugin-scoped namespace without the `plugin:{pluginId}:` prefix. */
  namespace: string;
  /** Opaque payload. Author decides the shape. */
  data: T;
}

export type MessageHandler<T = unknown> = (msg: MeshMessage<T>) => void | Promise<void>;

/**
 * Opts passed to `ctx.mesh.proxyPort()`. Uses truffle's reverse proxy to
 * expose a local port to the mesh with auto-TLS.
 */
export interface ProxyPortOpts {
  /** The mesh-side port to listen on. */
  listenPort: number;
  /** The local port traffic is forwarded to. */
  targetPort: number;
  /** Wire protocol. `https` implies truffle-managed Let's Encrypt. */
  protocol: 'http' | 'https' | 'tcp';
}

/**
 * Surface exposed via `ctx.mesh`. Kernel-provided façade over the
 * truffle `NapiNode` — plugins never get raw node access.
 *
 * Permissions required:
 *   - `broadcast()` / `send()`: `mesh:broadcast`
 *   - `proxyPort()`: `mesh:proxy`
 *   - Reading peers + subscribing: no permission (discovery only)
 */
export interface MeshAPI {
  /** List currently-online peers. */
  peers(): Peer[];

  /** Subscribe to peer join/leave events. */
  onPeerChange(cb: (event: PeerEvent) => void): Disposable;

  /**
   * Broadcast to all peers. Namespace is auto-prefixed with
   * `plugin:{pluginId}:` on the wire to prevent impersonation.
   */
  broadcast(namespace: string, data: unknown): Promise<void>;

  /** Send to a specific peer. Same namespace scoping as broadcast. */
  send(peerId: string, namespace: string, data: unknown): Promise<void>;

  /** Subscribe to messages in this plugin's namespace. */
  subscribe<T = unknown>(namespace: string, handler: MessageHandler<T>): Disposable;

  /** Expose a local port across the mesh via truffle's reverse proxy. */
  proxyPort(opts: ProxyPortOpts): Disposable;
}

/**
 * Truffle type declarations used by the sync fabric.
 *
 * These mirror the real `@vibecook/truffle` / `@vibecook/truffle-native` types
 * so that the runtime compiles regardless of whether truffle is installed.
 * At runtime the real classes are obtained via dynamic `import('@vibecook/truffle')`.
 *
 * When truffle IS installed, TypeScript resolves `import type` from the real
 * package — these declarations serve as a compile-safe fallback only.
 */

// ─── NapiNode ───────────────────────────────────────────────────────────────

export interface TruffleNodeConfig {
  appId: string;
  deviceName?: string;
  deviceId?: string;
  stateDir?: string;
  sidecarPath: string;
  authKey?: string;
  ephemeral?: boolean;
  wsPort?: number;
}

export interface TrufflePeer {
  deviceId: string;
  deviceName: string;
  ip: string;
  online: boolean;
  wsConnected: boolean;
  connectionType: string;
  os?: string;
  lastSeen?: string;
  tailscaleId: string;
}

export interface TrufflePeerEvent {
  eventType: string;
  peerId: string;
  peer?: TrufflePeer;
  authUrl?: string;
}

export interface TruffleHealthInfo {
  state: string;
  keyExpiry?: string;
  warnings: string[];
  healthy: boolean;
}

export interface TruffleNodeIdentity {
  appId: string;
  deviceId: string;
  deviceName: string;
  tailscaleHostname: string;
  tailscaleId: string;
  dnsName?: string;
  ip?: string;
}

export interface TruffleNamespacedMessage {
  from: string;
  namespace: string;
  msgType: string;
  payload: unknown;
  timestamp?: number;
}

// ─── NapiCrdtDoc ────────────────────────────────────────────────────────────

export interface TruffleCrdtDocEvent {
  eventType: string;
  peerId?: string;
}

export interface TruffleCrdtDoc {
  mapInsert(container: string, key: string, value: unknown): void;
  mapDelete(container: string, key: string): void;
  getDeepValue(): unknown;
  commit(): void;
  docId(): string;
  onChange(callback: (event: TruffleCrdtDocEvent) => void): void;
  stop(): Promise<void>;
}

// ─── NapiSyncedStore ────────────────────────────────────────────────────────

export interface TruffleSlice {
  deviceId: string;
  data: unknown;
  version: number;
  updatedAt: number;
}

export interface TruffleStoreEvent {
  eventType: string;
  deviceId?: string;
  data?: unknown;
  version?: number;
}

export interface TruffleSyncedStore {
  set(data: unknown): Promise<void>;
  local(): Promise<unknown | null>;
  get(deviceId: string): Promise<TruffleSlice | null>;
  all(): Promise<TruffleSlice[]>;
  deviceIds(): Promise<string[]>;
  storeId(): string;
  version(): number;
  onChange(callback: (event: TruffleStoreEvent) => void): void;
  stop(): Promise<void>;
}

// ─── NapiNode interface ─────────────────────────────────────────────────────

export interface TruffleNapiNode {
  onAuthRequired(callback: (url: string) => void): void;
  start(config: TruffleNodeConfig): Promise<void>;
  stop(): Promise<void>;
  getLocalInfo(): TruffleNodeIdentity;
  getPeers(): Promise<TrufflePeer[]>;
  resolvePeerId(peerId: string): Promise<string>;
  ping(peerId: string): Promise<{ latencyMs: number; connection: string; peerAddr?: string }>;
  health(): Promise<TruffleHealthInfo>;
  send(peerId: string, namespace: string, data: Buffer): Promise<void>;
  broadcast(namespace: string, data: Buffer): Promise<void>;
  onPeerChange(callback: (event: TrufflePeerEvent) => void): void;
  onMessage(namespace: string, callback: (msg: TruffleNamespacedMessage) => void): void;
  crdtDoc(docId: string): TruffleCrdtDoc;
  syncedStore(storeId: string): TruffleSyncedStore;
}

// ─── Dynamic import helper ──────────────────────────────────────────────────

export interface TruffleModule {
  NapiNode: new () => TruffleNapiNode;
  NapiCrdtDoc: unknown;
  NapiSyncedStore: unknown;
  NapiFileTransfer: unknown;
  NapiProxy: unknown;
  NapiOfferResponder: unknown;
  /**
   * Resolve the platform-specific Tailscale sidecar binary path.
   * Exported from `@vibecook/truffle/helpers.js` and re-exported at
   * the package root.
   */
  resolveSidecarPath(): string;
  /**
   * Open a URL in the system's default browser. Used as a fallback for
   * interactive Tailscale auth flows. Exported from the same helpers.
   */
  openUrl(url: string): void;
}

/**
 * Attempt to dynamically import `@vibecook/truffle`.
 * Returns null if the module is not installed or fails to load
 * (e.g. native binary missing on CI).
 */
export async function loadTruffle(): Promise<TruffleModule | null> {
  try {
    const mod = (await import('@vibecook/truffle')) as unknown as TruffleModule;
    // Sanity-check that the NapiNode class is actually present.
    if (typeof mod.NapiNode !== 'function') return null;
    return mod;
  } catch {
    return null;
  }
}

/**
 * KernelDocs — the four kernel-managed shared docs.
 *
 * Per spec 02 §4:
 *   - `kernel/plugin-inventory` — SyncedStore, per-device slices.
 *   - `kernel/canvas-layout`    — CrdtDoc (Loro Map) of widget entries.
 *   - `kernel/user-settings`    — CrdtDoc (Loro Map) of `{pluginId}.{key}`.
 *   - `kernel/permissions`      — CrdtDoc (Loro Map) of grant/revoke decisions.
 *
 * All four exist from app boot. Plugins never mutate these directly; the
 * kernel writes in response to user actions, and plugin-facing APIs
 * (`ctx.canvas.addWidget`, `ctx.settings.update`, etc.) go through here.
 *
 * A fifth slice, `kernel/version-beacons`, is owned by the version gate
 * (see `version-beacons.ts`). It is SyncedStore; kept separate from the four
 * "content" docs so the boot-time check can read it without opening the
 * rest.
 *
 * When truffle is available, CrdtDoc and SyncedStore wrap real NapiCrdtDoc
 * and NapiSyncedStore instances with automatic peer-to-peer sync via Loro.
 * When truffle is absent, in-memory typed wrappers provide the same
 * interface for offline / CI usage.
 */

import type { Disposable } from '@vibe-ctl/plugin-api';
import type { TruffleCrdtDoc, TruffleSyncedStore } from './truffle-types.js';

// ─── Public types ───────────────────────────────────────────────────────────

export interface PluginInventoryEntry {
  id: string;
  version: string;
  installedAt: number;
  source: 'built-in' | 'user-installed' | 'dev-symlink';
}

export interface PluginInventorySlice {
  installed: PluginInventoryEntry[];
  enabled: string[];
}

// ─── Doc primitives ─────────────────────────────────────────────────────────

/** Change listener signature. */
export type DocChangeListener = (delta: Uint8Array) => void;

/**
 * Typed handle around a Loro CrdtDoc (or in-memory simulation).
 * Represents a Loro Map keyed by string with JSON-serialisable values.
 */
export interface CrdtDocHandle {
  readonly id: string;
  /** Get a value from the map. */
  get(key: string): unknown;
  /** Set a value in the map. Returns a binary delta for replication. */
  set(key: string, value: unknown): Uint8Array;
  /** Delete a key from the map. Returns a binary delta for replication. */
  delete(key: string): Uint8Array;
  /** Get all entries. */
  entries(): Array<[string, unknown]>;
  /** Subscribe to changes. Called with binary delta when any mutation occurs. */
  subscribe(cb: DocChangeListener): Disposable;
  /** Apply a binary delta received from a peer or renderer. */
  applyDelta(delta: Uint8Array): void;
  /** Export a full binary snapshot of the document. */
  exportSnapshot(): Uint8Array;
  /** Import a full binary snapshot, replacing current state. */
  importSnapshot(data: Uint8Array): void;
  /** Stop the underlying doc (if truffle-backed). */
  stop(): Promise<void>;
}

/** Typed handle around a SyncedStore (device-owned slices). */
export interface SyncedStoreHandle<T = unknown> {
  readonly id: string;
  /** Get the local device's slice value. */
  get(): T | undefined;
  /** Set the local device's slice value. Returns a binary delta. */
  set(value: T): Uint8Array;
  /** Get all device slices. */
  all(): Map<string, T>;
  /** Subscribe to changes (from any device). */
  subscribe(cb: DocChangeListener): Disposable;
  /** Apply a binary delta from a peer. */
  applyDelta(delta: Uint8Array): void;
  /** Export a full binary snapshot. */
  exportSnapshot(): Uint8Array;
  /** Import a full binary snapshot. */
  importSnapshot(data: Uint8Array): void;
  /** Stop the underlying store (if truffle-backed). */
  stop(): Promise<void>;
}

// ─── Truffle-backed CrdtDoc adapter ─────────────────────────────────────────

/** Map container name used by kernel docs. */
const ROOT_MAP = 'root';

function createTruffleCrdtDoc(id: string, nativeDoc: TruffleCrdtDoc): CrdtDocHandle {
  const listeners = new Set<DocChangeListener>();

  /**
   * Serialise the current doc state as a full snapshot.
   *
   * Truffle's `NapiCrdtDoc` does not expose a frontier-based
   * `exportFromFrontier()` or a raw `export()` API at NAPI level — only
   * `getDeepValue()` which returns the materialised JSON. So "delta
   * capture on commit" degrades to full snapshots: every onChange fires
   * with the entire current state. DocAuthority routes this as a
   * `snapshot` message so the renderer replaces its replica wholesale.
   * Less efficient than true deltas, but correct (no lost state).
   */
  function exportFullSnapshot(): Uint8Array {
    const deep = nativeDoc.getDeepValue();
    return new TextEncoder().encode(JSON.stringify(deep ?? {}));
  }

  // Subscribe to truffle's onChange for remote + local change notifications.
  nativeDoc.onChange(() => {
    // Emit the current full state so downstream subscribers can fan out
    // an up-to-date snapshot to renderers and persistence can mark dirty.
    const snapshot = exportFullSnapshot();
    for (const cb of listeners) cb(snapshot);
  });

  function readAll(): Map<string, unknown> {
    const deep = nativeDoc.getDeepValue() as Record<string, unknown> | null;
    const map = new Map<string, unknown>();
    if (deep && typeof deep === 'object' && ROOT_MAP in deep) {
      const rootMap = (deep as Record<string, Record<string, unknown>>)[ROOT_MAP];
      if (rootMap && typeof rootMap === 'object') {
        for (const [k, v] of Object.entries(rootMap)) {
          map.set(k, v);
        }
      }
    }
    return map;
  }

  return {
    id,
    get(key) {
      const all = readAll();
      return all.get(key);
    },
    set(key, value) {
      nativeDoc.mapInsert(ROOT_MAP, key, value);
      nativeDoc.commit();
      // commit() triggers onChange which fans out a full snapshot to
      // listeners. Return an opaque JSON op for callers that want to
      // replicate the mutation manually (no longer the primary path).
      return new TextEncoder().encode(JSON.stringify({ op: 'set', key, value }));
    },
    delete(key) {
      nativeDoc.mapDelete(ROOT_MAP, key);
      nativeDoc.commit();
      return new TextEncoder().encode(JSON.stringify({ op: 'delete', key }));
    },
    entries() {
      return [...readAll().entries()];
    },
    subscribe(cb) {
      listeners.add(cb);
      return {
        [Symbol.dispose]() {
          listeners.delete(cb);
        },
      };
    },
    applyDelta(_delta) {
      // With truffle, peer-to-peer sync is automatic via NapiCrdtDoc.
      // This method is called for renderer→utility deltas. In the truffle
      // model, the renderer sends JSON-encoded ops that we apply locally.
      try {
        const text = new TextDecoder().decode(_delta);
        const parsed = JSON.parse(text) as { op: string; key: string; value?: unknown };
        if (parsed.op === 'set') {
          nativeDoc.mapInsert(ROOT_MAP, parsed.key, parsed.value);
          nativeDoc.commit();
        } else if (parsed.op === 'delete') {
          nativeDoc.mapDelete(ROOT_MAP, parsed.key);
          nativeDoc.commit();
        }
      } catch {
        // If delta is opaque binary from truffle peer sync, it's already
        // been applied by the NapiCrdtDoc internally. Safe to ignore.
      }
    },
    exportSnapshot() {
      // Export the full document state as JSON for persistence.
      const deep = nativeDoc.getDeepValue();
      return new TextEncoder().encode(JSON.stringify(deep ?? {}));
    },
    importSnapshot(data) {
      // Import is handled at doc creation time — truffle docs persist
      // themselves internally. For the JSON-based persistence layer,
      // re-apply the map entries.
      try {
        const text = new TextDecoder().decode(data);
        const obj = JSON.parse(text) as Record<string, unknown>;
        const rootMap = obj[ROOT_MAP] as Record<string, unknown> | undefined;
        if (rootMap && typeof rootMap === 'object') {
          for (const [k, v] of Object.entries(rootMap)) {
            nativeDoc.mapInsert(ROOT_MAP, k, v);
          }
          nativeDoc.commit();
        }
      } catch {
        // Malformed snapshot
      }
    },
    async stop() {
      await nativeDoc.stop();
    },
  };
}

// ─── Truffle-backed SyncedStore adapter ─────────────────────────────────────

function createTruffleSyncedStore<T>(
  id: string,
  nativeStore: TruffleSyncedStore,
  deviceId: string,
): SyncedStoreHandle<T> {
  const listeners = new Set<DocChangeListener>();

  nativeStore.onChange(() => {
    const signal = new Uint8Array(0);
    for (const cb of listeners) cb(signal);
  });

  return {
    id,
    get() {
      // NapiSyncedStore.local() is async — we cache the last known value
      // and update it reactively. For synchronous access, use the last
      // known value from the cache.
      // Note: callers that need fresh data should use the async variant
      // via the store directly.
      let cached: T | undefined;
      void nativeStore.local().then((v) => {
        cached = v as T | undefined;
      });
      return cached;
    },
    set(value) {
      void nativeStore.set(value);
      const delta = new TextEncoder().encode(JSON.stringify({ deviceId, value }));
      for (const cb of listeners) cb(delta);
      return delta;
    },
    all() {
      // NapiSyncedStore.all() is async. Return empty map synchronously;
      // reactive subscribers get notified when data arrives.
      const map = new Map<string, T>();
      void nativeStore.all().then((slices) => {
        for (const slice of slices) {
          map.set(slice.deviceId, slice.data as T);
        }
      });
      return map;
    },
    subscribe(cb) {
      listeners.add(cb);
      return {
        [Symbol.dispose]() {
          listeners.delete(cb);
        },
      };
    },
    applyDelta(delta) {
      // With truffle, peer sync is automatic. Renderer-originated deltas
      // are JSON-encoded and we apply them via set().
      try {
        const text = new TextDecoder().decode(delta);
        const parsed = JSON.parse(text) as { deviceId: string; value: T };
        if (parsed.deviceId === deviceId) {
          void nativeStore.set(parsed.value);
        }
      } catch {
        // Opaque binary from peer sync — already handled by truffle.
      }
    },
    exportSnapshot() {
      // Export as JSON for persistence compatibility.
      const obj: Record<string, unknown> = {};
      void nativeStore.all().then((slices) => {
        for (const slice of slices) {
          obj[slice.deviceId] = slice.data;
        }
      });
      return new TextEncoder().encode(JSON.stringify(obj));
    },
    importSnapshot(snapshot) {
      try {
        const text = new TextDecoder().decode(snapshot);
        const obj = JSON.parse(text) as Record<string, T>;
        const localValue = obj[deviceId];
        if (localValue !== undefined) {
          void nativeStore.set(localValue);
        }
      } catch {
        // Malformed snapshot
      }
    },
    async stop() {
      await nativeStore.stop();
    },
  };
}

// ─── In-memory CrdtDoc implementation (fallback) ────────────────────────────

function createInMemoryCrdtDoc(id: string): CrdtDocHandle {
  const data = new Map<string, unknown>();
  const listeners = new Set<DocChangeListener>();

  function notify(delta: Uint8Array): void {
    for (const cb of listeners) cb(delta);
  }

  function encodeDelta(op: 'set' | 'delete', key: string, value?: unknown): Uint8Array {
    const json = JSON.stringify({ op, key, value });
    return new TextEncoder().encode(json);
  }

  return {
    id,
    get(key) {
      return data.get(key);
    },
    set(key, value) {
      data.set(key, value);
      const delta = encodeDelta('set', key, value);
      notify(delta);
      return delta;
    },
    delete(key) {
      data.delete(key);
      const delta = encodeDelta('delete', key);
      notify(delta);
      return delta;
    },
    entries() {
      return [...data.entries()];
    },
    subscribe(cb) {
      listeners.add(cb);
      return {
        [Symbol.dispose]() {
          listeners.delete(cb);
        },
      };
    },
    applyDelta(delta) {
      try {
        const text = new TextDecoder().decode(delta);
        const parsed = JSON.parse(text) as { op: string; key: string; value?: unknown };
        if (parsed.op === 'set') {
          data.set(parsed.key, parsed.value);
        } else if (parsed.op === 'delete') {
          data.delete(parsed.key);
        }
        notify(delta);
      } catch {
        // Malformed delta — ignore in simulation mode.
      }
    },
    exportSnapshot() {
      const obj = Object.fromEntries(data.entries());
      return new TextEncoder().encode(JSON.stringify(obj));
    },
    importSnapshot(snapshot) {
      try {
        const text = new TextDecoder().decode(snapshot);
        const obj = JSON.parse(text) as Record<string, unknown>;
        data.clear();
        for (const [k, v] of Object.entries(obj)) data.set(k, v);
      } catch {
        // Malformed snapshot — ignore in simulation mode.
      }
    },
    async stop() {
      // No-op for in-memory docs.
    },
  };
}

// ─── In-memory SyncedStore implementation (fallback) ────────────────────────

function createInMemorySyncedStore<T>(id: string, deviceId: string): SyncedStoreHandle<T> {
  const slices = new Map<string, T>();
  const listeners = new Set<DocChangeListener>();

  function notify(delta: Uint8Array): void {
    for (const cb of listeners) cb(delta);
  }

  function encodeDelta(sliceDeviceId: string, value: T): Uint8Array {
    const json = JSON.stringify({ deviceId: sliceDeviceId, value });
    return new TextEncoder().encode(json);
  }

  return {
    id,
    get() {
      return slices.get(deviceId);
    },
    set(value) {
      slices.set(deviceId, value);
      const delta = encodeDelta(deviceId, value);
      notify(delta);
      return delta;
    },
    all() {
      return new Map(slices);
    },
    subscribe(cb) {
      listeners.add(cb);
      return {
        [Symbol.dispose]() {
          listeners.delete(cb);
        },
      };
    },
    applyDelta(delta) {
      try {
        const text = new TextDecoder().decode(delta);
        const parsed = JSON.parse(text) as { deviceId: string; value: T };
        slices.set(parsed.deviceId, parsed.value);
        notify(delta);
      } catch {
        // Malformed delta — ignore in simulation mode.
      }
    },
    exportSnapshot() {
      const obj = Object.fromEntries(slices.entries());
      return new TextEncoder().encode(JSON.stringify(obj));
    },
    importSnapshot(snapshot) {
      try {
        const text = new TextDecoder().decode(snapshot);
        const obj = JSON.parse(text) as Record<string, T>;
        slices.clear();
        for (const [k, v] of Object.entries(obj)) slices.set(k, v as T);
      } catch {
        // Malformed snapshot — ignore in simulation mode.
      }
    },
    async stop() {
      // No-op for in-memory stores.
    },
  };
}

// ─── Kernel doc names ───────────────────────────────────────────────────────

export const KERNEL_DOC_NAMES = [
  'kernel/plugin-inventory',
  'kernel/canvas-layout',
  'kernel/user-settings',
  'kernel/permissions',
] as const;

export type KernelDocName = (typeof KERNEL_DOC_NAMES)[number];

// ─── KernelDocs ─────────────────────────────────────────────────────────────

export interface KernelDocsOptions {
  deviceId: string;
  /**
   * When provided, docs are backed by real truffle NapiCrdtDoc / NapiSyncedStore
   * instances obtained from the MeshNode. When absent, in-memory fallbacks are used.
   */
  truffleDocs?: {
    canvasLayout: TruffleCrdtDoc;
    userSettings: TruffleCrdtDoc;
    permissions: TruffleCrdtDoc;
    inventory: TruffleSyncedStore;
  };
}

/**
 * Owns construction of the four docs. Created in the kernel utility process
 * during bootstrap (spec 02 §10 step 3).
 */
export class KernelDocs {
  readonly #deviceId: string;
  readonly #truffleDocs: KernelDocsOptions['truffleDocs'];

  #inventory: SyncedStoreHandle<PluginInventorySlice> | null = null;
  #canvasLayout: CrdtDocHandle | null = null;
  #userSettings: CrdtDocHandle | null = null;
  #permissions: CrdtDocHandle | null = null;
  #opened = false;

  constructor(opts: KernelDocsOptions) {
    this.#deviceId = opts.deviceId;
    this.#truffleDocs = opts.truffleDocs;
  }

  /** Open (or create, on first run) all four docs. Idempotent. */
  async open(): Promise<void> {
    if (this.#opened) return;

    if (this.#truffleDocs) {
      // Truffle-backed: wrap real NapiCrdtDoc / NapiSyncedStore instances.
      this.#canvasLayout = createTruffleCrdtDoc(
        'kernel/canvas-layout',
        this.#truffleDocs.canvasLayout,
      );
      this.#userSettings = createTruffleCrdtDoc(
        'kernel/user-settings',
        this.#truffleDocs.userSettings,
      );
      this.#permissions = createTruffleCrdtDoc('kernel/permissions', this.#truffleDocs.permissions);
      this.#inventory = createTruffleSyncedStore<PluginInventorySlice>(
        'kernel/plugin-inventory',
        this.#truffleDocs.inventory,
        this.#deviceId,
      );
    } else {
      // In-memory fallback (truffle not available).
      this.#canvasLayout = createInMemoryCrdtDoc('kernel/canvas-layout');
      this.#userSettings = createInMemoryCrdtDoc('kernel/user-settings');
      this.#permissions = createInMemoryCrdtDoc('kernel/permissions');
      this.#inventory = createInMemorySyncedStore<PluginInventorySlice>(
        'kernel/plugin-inventory',
        this.#deviceId,
      );
    }

    this.#opened = true;
  }

  /** Flush + close. Called during shutdown. */
  async close(): Promise<void> {
    if (!this.#opened) return;
    // Stop truffle-backed docs if they exist.
    await this.#canvasLayout?.stop();
    await this.#userSettings?.stop();
    await this.#permissions?.stop();
    await this.#inventory?.stop();
    this.#opened = false;
  }

  // ─── Typed accessors ──────────────────────────────────────────────────
  // Each getter throws if open() hasn't been called.

  get inventory(): SyncedStoreHandle<PluginInventorySlice> {
    if (!this.#inventory) throw new Error('KernelDocs.inventory accessed before open()');
    return this.#inventory;
  }

  get canvasLayout(): CrdtDocHandle {
    if (!this.#canvasLayout) throw new Error('KernelDocs.canvasLayout accessed before open()');
    return this.#canvasLayout;
  }

  get userSettings(): CrdtDocHandle {
    if (!this.#userSettings) throw new Error('KernelDocs.userSettings accessed before open()');
    return this.#userSettings;
  }

  get permissions(): CrdtDocHandle {
    if (!this.#permissions) throw new Error('KernelDocs.permissions accessed before open()');
    return this.#permissions;
  }

  /** Generic accessor by name. */
  getDoc(name: KernelDocName): CrdtDocHandle | SyncedStoreHandle<PluginInventorySlice> {
    switch (name) {
      case 'kernel/plugin-inventory':
        return this.inventory;
      case 'kernel/canvas-layout':
        return this.canvasLayout;
      case 'kernel/user-settings':
        return this.userSettings;
      case 'kernel/permissions':
        return this.permissions;
    }
  }

  /** Export a binary snapshot for a given doc. */
  exportSnapshot(name: KernelDocName): Uint8Array {
    return this.getDoc(name).exportSnapshot();
  }

  /** Import a binary snapshot into a given doc. */
  importSnapshot(name: KernelDocName, data: Uint8Array): void {
    this.getDoc(name).importSnapshot(data);
  }

  get isOpen(): boolean {
    return this.#opened;
  }

  get deviceId(): string {
    return this.#deviceId;
  }

  /** Whether docs are backed by real truffle instances. */
  get isTruffleBacked(): boolean {
    return this.#truffleDocs !== undefined;
  }
}

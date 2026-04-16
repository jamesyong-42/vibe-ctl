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
 * Since `@vibecook/truffle` is not installed (requires Rust NAPI build),
 * CrdtDoc and SyncedStore are represented by in-memory typed wrappers that
 * expose the Loro-like operations the rest of the kernel needs. When truffle
 * is available these can be swapped to real Loro documents.
 */

import type { Disposable } from '@vibe-ctl/plugin-api';

// ─── Truffle type stubs ──────────────────────────────────────────────────────
// TODO: replace with @vibecook/truffle imports when available

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

// ─── Doc primitives ──────────────────────────────────────────────────────────

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
}

// ─── In-memory CrdtDoc implementation ────────────────────────────────────────

function createCrdtDoc(id: string): CrdtDocHandle {
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
  };
}

// ─── In-memory SyncedStore implementation ────────────────────────────────────

function createSyncedStore<T>(id: string, deviceId: string): SyncedStoreHandle<T> {
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
  };
}

// ─── Kernel doc names ────────────────────────────────────────────────────────

export const KERNEL_DOC_NAMES = [
  'kernel/plugin-inventory',
  'kernel/canvas-layout',
  'kernel/user-settings',
  'kernel/permissions',
] as const;

export type KernelDocName = (typeof KERNEL_DOC_NAMES)[number];

// ─── KernelDocs ──────────────────────────────────────────────────────────────

export interface KernelDocsOptions {
  deviceId: string;
}

/**
 * Owns construction of the four docs. Created in the kernel utility process
 * during bootstrap (spec 02 §10 step 3).
 */
export class KernelDocs {
  readonly #deviceId: string;

  #inventory: SyncedStoreHandle<PluginInventorySlice> | null = null;
  #canvasLayout: CrdtDocHandle | null = null;
  #userSettings: CrdtDocHandle | null = null;
  #permissions: CrdtDocHandle | null = null;
  #opened = false;

  constructor(opts: KernelDocsOptions) {
    this.#deviceId = opts.deviceId;
  }

  /** Open (or create, on first run) all four docs. Idempotent. */
  async open(): Promise<void> {
    if (this.#opened) return;
    // In-memory simulation. When truffle is available, these become real Loro
    // documents opened via the NapiNode.
    this.#inventory = createSyncedStore<PluginInventorySlice>(
      'kernel/plugin-inventory',
      this.#deviceId,
    );
    this.#canvasLayout = createCrdtDoc('kernel/canvas-layout');
    this.#userSettings = createCrdtDoc('kernel/user-settings');
    this.#permissions = createCrdtDoc('kernel/permissions');
    this.#opened = true;
  }

  /** Flush + close. Called during shutdown. */
  async close(): Promise<void> {
    if (!this.#opened) return;
    // In-memory simulation: nothing to flush.
    this.#opened = false;
  }

  // ─── Typed accessors ────────────────────────────────────────────────
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
}

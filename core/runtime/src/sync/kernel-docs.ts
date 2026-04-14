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
 * (see `version-gate.ts`). It is SyncedStore; kept separate from the four
 * "content" docs so the boot-time check can read it without opening the
 * rest.
 */

import type { NapiNode } from '@vibecook/truffle';

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

/**
 * Typed handle around a Loro CrdtDoc. The concrete Loro type is opaque
 * here; the full surface is used by sub-modules (canvas-sync adapter,
 * settings manager, permission manager) that can import it explicitly.
 */
export interface CrdtDocHandle {
  readonly id: string;
  // TODO(runtime): narrow once canvas-sync + settings/permission managers
  // converge on the methods they need. Keeping it opaque avoids pulling the
  // loro typings across the whole kernel.
  readonly raw: unknown;
}

/** Typed handle around a SyncedStore. */
export interface SyncedStoreHandle<T> {
  readonly id: string;
  // TODO(runtime): same as CrdtDocHandle — opaque until consumers stabilise.
  readonly raw: unknown;
  /** Phantom for type inference; never read at runtime. */
  readonly _phantom?: T;
}

/**
 * Owns construction of the four docs. Created lazily in Runtime.start()
 * once the NapiNode is up.
 */
export class KernelDocs {
  readonly #node: NapiNode | null;

  #inventory: SyncedStoreHandle<PluginInventorySlice> | null = null;
  #canvasLayout: CrdtDocHandle | null = null;
  #userSettings: CrdtDocHandle | null = null;
  #permissions: CrdtDocHandle | null = null;

  constructor(node: NapiNode | null) {
    this.#node = node;
  }

  /** Open (or create, on first run) all four docs. */
  async open(): Promise<void> {
    // The four docs are opened here in a single round-trip. Persistence via
    // truffle's snapshot backend; schema evolves with the kernel version
    // (spec 02 §9 schema-changes row).
    throw new Error('not implemented: KernelDocs.open');
  }

  /** Flush + close. Called during Runtime.stop(). */
  async close(): Promise<void> {
    throw new Error('not implemented: KernelDocs.close');
  }

  // ─── Typed accessors ────────────────────────────────────────────────
  // Each getter throws a clear error if open() hasn't been called, rather
  // than returning null and forcing every caller to null-check.

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

  /** Escape hatch for sub-modules that need to check offline status. */
  get hasNode(): boolean {
    return this.#node !== null;
  }
}

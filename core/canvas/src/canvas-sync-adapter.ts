import type { Disposable } from '@vibe-ctl/plugin-api';
import type { KernelCanvasEngine } from './engine.js';

/**
 * Opaque Loro-doc handle from truffle. The truffle package exports a
 * `CrdtDoc` type; we use it only structurally here so this package
 * keeps a *peer* dep on `@vibecook/truffle` rather than a direct one.
 *
 * TODO: Switch to `import type { CrdtDoc } from '@vibecook/truffle'`
 *       once that package is installed locally.
 */
export interface CrdtDocLike {
  /** Subscribe to remote updates. Returns an unsubscribe fn or Disposable. */
  // biome-ignore lint/suspicious/noExplicitAny: structural placeholder
  subscribe(listener: (update: any) => void): () => void;
  /** Access a map by name. Loro doc interface. */
  // biome-ignore lint/suspicious/noExplicitAny: structural placeholder
  getMap(name: string): any;
}

export interface CanvasSyncAdapterOptions {
  /** The kernel canvas engine this adapter bridges. */
  canvasEngine: KernelCanvasEngine;
  /**
   * The `kernel/canvas-layout` CrdtDoc (spec 02 §4.2). Owned by the
   * kernel runtime; adapter never creates or disposes it.
   */
  crdtDoc: CrdtDocLike;
  /**
   * Name of the Loro map that holds widget entries inside the doc.
   * Defaults to `'widgets'`.
   */
  widgetsMapName?: string;
}

/**
 * Bridges the infinite-canvas ECS world to the kernel-owned
 * `kernel/canvas-layout` CrdtDoc.
 *
 * Responsibilities (per spec 02 §4.2):
 *
 *   1. **Filter:** only entities with the `Widget` component sync.
 *      Transient UI entities (resize handles, snap guides, hit
 *      regions) stay local.
 *   2. **Serialize local → remote:** hooks infinite-canvas's
 *      `onFrame`. Each frame reads `getFrameChanges()` and applies
 *      the matching deltas to the Loro doc via
 *      `serializeEntities(...)` for new entities.
 *   3. **Apply remote → local:** subscribes to the Loro doc's update
 *      stream. Incoming deltas apply to the canvas world via the
 *      engine's command API, wrapped in a `#remoteApplying = true`
 *      flag.
 *   4. **Echo suppression:** when reading `getFrameChanges()` during
 *      a remote-apply frame, skip it. Prevents the local-write
 *      round-trip.
 *
 * Adapter is internal. Infinite-canvas stays sync-agnostic.
 */
export class CanvasSyncAdapter {
  readonly #engine: KernelCanvasEngine;
  readonly #doc: CrdtDocLike;
  readonly #widgetsMapName: string;

  /**
   * Echo-suppression flag. True while we are applying a remote delta
   * into the canvas ECS world. The `onFrame` hook checks this and
   * skips `getFrameChanges()` processing during those frames.
   */
  #remoteApplying = false;

  #frameSub: Disposable | null = null;
  #docUnsub: (() => void) | null = null;
  #started = false;

  constructor(opts: CanvasSyncAdapterOptions) {
    this.#engine = opts.canvasEngine;
    this.#doc = opts.crdtDoc;
    this.#widgetsMapName = opts.widgetsMapName ?? 'widgets';
  }

  /**
   * Begin bidirectional sync. Must be called exactly once before the
   * canvas is shown to the user (spec 02 §10 step 5).
   */
  start(): void {
    if (this.#started) return;
    this.#started = true;

    // TODO: Subscribe to `this.#engine.engine.onFrame(...)` and in the
    //       handler:
    //       - If `this.#remoteApplying`, return early (echo-suppress).
    //       - Otherwise call `getFrameChanges()` on the engine, filter
    //         to entities with the `Widget` component, and apply as
    //         deltas to `this.#doc.getMap(this.#widgetsMapName)`.
    //       - For new entities use `serializeEntities([...])` from
    //         infinite-canvas; for position updates use a partial
    //         set on the existing map value; for deletions use
    //         `map.delete(widgetId)`.
    this.#frameSub = null;

    // TODO: Subscribe to `this.#doc.subscribe(update => this.#applyRemote(update))`.
    //       Inside `#applyRemote` set `#remoteApplying = true`, dispatch
    //       the delta into the canvas world (use `deserializeWorld` for
    //       bulk bootstrap; otherwise command API per-entity), then clear
    //       the flag in a `try/finally`.
    this.#docUnsub = null;
  }

  /**
   * Stop both subscriptions. Idempotent. Called during kernel teardown
   * (spec 02 §10 step 10).
   */
  stop(): void {
    if (!this.#started) return;
    this.#started = false;

    // TODO: Dispose the onFrame subscription.
    this.#frameSub?.dispose?.();
    this.#frameSub = null;

    // TODO: Dispose the Loro subscription.
    this.#docUnsub?.();
    this.#docUnsub = null;
  }

  // ─── Private sync paths (stubbed) ───────────────────────────────

  /**
   * Apply a remote Loro delta into the canvas ECS world. Wraps
   * application in the `#remoteApplying` flag so `onFrame` can skip
   * the resulting local frame.
   */
  // biome-ignore lint/suspicious/noExplicitAny: update shape TBD
  #applyRemote(_update: any): void {
    if (!this.#started) return;

    this.#remoteApplying = true;
    try {
      // TODO: For each added/updated widget entry in the delta, either
      //       create a new entity (via canvas engine command API) or
      //       patch the `Widget`/`Transform` components on the existing
      //       entity. For deleted entries, destroy the entity.
      //       Use `deserializeWorld` only for the initial bootstrap
      //       path, not for incremental deltas.
    } finally {
      this.#remoteApplying = false;
    }
  }

  /**
   * Broadcast local ECS changes to the Loro doc. Called from the
   * onFrame handler (skipped when `#remoteApplying` is true).
   */
  // biome-ignore lint/suspicious/noExplicitAny: frame-changes shape TBD
  #broadcastLocal(_changes: any): void {
    if (this.#remoteApplying) return;

    // TODO: Translate ECS frame changes into Loro map ops. Use
    //       `serializeEntities([...])` for creations, partial map.set
    //       for updates, map.delete for removals. Decisions in spec 02
    //       (last bullet): full-entity snapshot per widget for v1.
  }
}

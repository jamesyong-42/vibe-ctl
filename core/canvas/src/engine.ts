import type { Disposable, WidgetDef } from '@vibe-ctl/extension-api';
import {
  type WidgetTypeEntry,
  type WidgetTypeId,
  type WidgetTypeListener,
  WidgetTypeRegistry,
} from './widget-type-registry.js';

/**
 * Opaque handle to the underlying infinite-canvas LayoutEngine. The
 * library returns a plugin object from `createLayoutEngine(...)`; we
 * intentionally keep the full type opaque here to avoid leaking
 * third-party internals into our public surface.
 *
 * TODO: Replace `unknown` with the library's exported engine type once
 * the runtime imports it. Declared here as a structural placeholder.
 */
// biome-ignore lint/suspicious/noExplicitAny: placeholder until library types plumb through
export type InfiniteCanvasEngine = any;

/**
 * Options passed into `KernelCanvasEngine`. Mirrors the subset of
 * infinite-canvas `createLayoutEngine` options we care about at the
 * kernel layer. Kept narrow on purpose; the runtime can extend.
 */
export interface KernelCanvasEngineOptions {
  /** DOM container for the canvas. Runtime mounts this. */
  container?: HTMLElement;
  /** Additional options forwarded verbatim to `createLayoutEngine`. */
  // biome-ignore lint/suspicious/noExplicitAny: forwarded pass-through
  layoutEngineOptions?: Record<string, any>;
}

/**
 * Kernel-aware wrapper over `@jamesyong42/infinite-canvas`.
 *
 * Adds a reactive widget-type registry. Plugins never touch this
 * directly — they go through `ctx.widgets.register()`, and the runtime
 * proxies the call to `registerWidgetType` here.
 *
 * The infinite-canvas library already exposes `registerSystem`,
 * `removeSystem`, `serializeWorld`, `deserializeWorld`, and
 * `serializeEntities`; the sync adapter uses those directly against
 * `.engine` below.
 */
export class KernelCanvasEngine {
  readonly #typeRegistry = new WidgetTypeRegistry();
  readonly #engine: InfiniteCanvasEngine;
  #disposed = false;

  constructor(_options: KernelCanvasEngineOptions = {}) {
    // TODO: Replace with `createLayoutEngine(options.layoutEngineOptions)`
    //       once `@jamesyong42/infinite-canvas` is installed. Returning a
    //       placeholder lets typecheck pass before installation.
    this.#engine = undefined as unknown as InfiniteCanvasEngine;
  }

  /** The wrapped infinite-canvas engine. Exposed for the sync adapter. */
  get engine(): InfiniteCanvasEngine {
    return this.#engine;
  }

  /** The reactive widget-type registry. */
  get widgetTypes(): WidgetTypeRegistry {
    return this.#typeRegistry;
  }

  // ─── Widget-type surface ────────────────────────────────────────

  /**
   * Register a widget type. Called by the runtime whenever a plugin
   * invokes `ctx.widgets.register()`. Returns a Disposable that
   * removes the registration on dispose.
   *
   * The kernel world also mirrors this entry into its `WidgetType` ECS
   * component so reactive queries (e.g. "all widgets contributed by
   * plugin X") stay in sync. That mirroring is wired up by the
   * runtime — this class only owns the widget-type registry itself.
   */
  registerWidgetType<Config>(def: WidgetDef<Config>): Disposable {
    this.#assertNotDisposed();
    return this.#typeRegistry.register(def);
  }

  /**
   * Force-remove a widget type by id. Normally the Disposable returned
   * from `registerWidgetType` handles this; this path exists for
   * kernel-initiated teardown (plugin crash, force-disable).
   */
  unregisterWidgetType(type: WidgetTypeId): void {
    this.#typeRegistry.unregister(type);
  }

  getWidgetType(type: WidgetTypeId): WidgetTypeEntry | undefined {
    return this.#typeRegistry.get(type);
  }

  /**
   * Subscribe to widget-type changes. Returns a Disposable. Used by
   * the missing-plugin placeholder and placement components to
   * re-render when new types come online.
   */
  subscribeTypes(listener: WidgetTypeListener): Disposable {
    return this.#typeRegistry.subscribe(listener);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  /**
   * Dispose the wrapped engine and clear all widget-type entries.
   * Idempotent. Called on app quit (spec 02 §10 step 10).
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // TODO: Invoke `this.#engine.dispose()` once infinite-canvas exposes it.
    // TODO: Clear `this.#typeRegistry` (no public clear(); iterate + unregister).
  }

  #assertNotDisposed(): void {
    if (this.#disposed) {
      throw new Error('[canvas] KernelCanvasEngine has been disposed.');
    }
  }
}

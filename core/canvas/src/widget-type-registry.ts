import type { Disposable, WidgetDef } from '@vibe-ctl/plugin-api';

/**
 * Reactive widget-type registry. Populated by plugins through
 * `ctx.widgets.register()` (the runtime forwards to
 * `KernelCanvasEngine.registerWidgetType`).
 *
 * The registry is the source of truth for "which widget types do we
 * know how to render?". Canvas placements and the
 * `MissingPluginPlaceholder` both query it.
 *
 * Implementation is a thin observable map. The kernel mirrors each
 * entry into its ECS `WidgetType` component so reactive queries from
 * other kernel systems observe the same updates.
 */

export type WidgetTypeId = string;

export interface WidgetTypeEntry<Config = unknown> {
  readonly def: WidgetDef<Config>;
  readonly registeredAt: number;
}

export type WidgetTypeChange =
  | { kind: 'added'; type: WidgetTypeId; entry: WidgetTypeEntry }
  | { kind: 'removed'; type: WidgetTypeId };

export type WidgetTypeListener = (change: WidgetTypeChange) => void;

/**
 * Minimal reactive container. Not tied to reactive-ecs directly — the
 * runtime wires these callbacks into its ECS world in a kernel
 * system. Keeping this class framework-neutral lets tests exercise it
 * without spinning up a world.
 */
export class WidgetTypeRegistry {
  readonly #entries = new Map<WidgetTypeId, WidgetTypeEntry>();
  readonly #listeners = new Set<WidgetTypeListener>();

  /**
   * Register a new widget type. Returns a Disposable that removes the
   * entry when disposed. Throws if `def.type` is already registered.
   */
  register<Config>(def: WidgetDef<Config>): Disposable {
    if (this.#entries.has(def.type)) {
      throw new Error(
        `[canvas] Widget type "${def.type}" is already registered (owned by "${
          this.#entries.get(def.type)?.def.ownedByPlugin
        }").`,
      );
    }

    // TODO: Validate that `def.placements` are non-empty and known.
    const entry: WidgetTypeEntry = {
      def: def as WidgetDef<unknown>,
      registeredAt: Date.now(),
    };
    this.#entries.set(def.type, entry);
    this.#emit({ kind: 'added', type: def.type, entry });

    return {
      dispose: () => {
        this.#entries.delete(def.type);
        this.#emit({ kind: 'removed', type: def.type });
      },
    };
  }

  /**
   * Remove a widget type by id. Used by the runtime when a plugin is
   * deactivated and its tracked disposables are invoked.
   */
  unregister(type: WidgetTypeId): void {
    if (!this.#entries.delete(type)) return;
    this.#emit({ kind: 'removed', type });
  }

  get(type: WidgetTypeId): WidgetTypeEntry | undefined {
    return this.#entries.get(type);
  }

  has(type: WidgetTypeId): boolean {
    return this.#entries.has(type);
  }

  /** All currently-registered widget-type entries. */
  list(): WidgetTypeEntry[] {
    return Array.from(this.#entries.values());
  }

  /**
   * Query by placement. Used by each `<*Placement>` slot component to
   * render the widgets declaring that placement. O(n) in the number of
   * registered types, which is fine for v1.
   */
  listByPlacement(placement: string): WidgetTypeEntry[] {
    const out: WidgetTypeEntry[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.def.placements.includes(placement as never)) {
        out.push(entry);
      }
    }
    return out;
  }

  /**
   * Subscribe to add/remove changes. Returns an unsubscribe disposable.
   */
  subscribe(listener: WidgetTypeListener): Disposable {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }

  #emit(change: WidgetTypeChange): void {
    for (const listener of this.#listeners) {
      try {
        listener(change);
      } catch (err) {
        // Listener errors must not break the registry. Surface via
        // console for now; kernel will wire a scoped logger later.
        // biome-ignore lint/suspicious/noConsole: kernel logger not wired yet
        console.error('[canvas] widget-type-registry listener failed', err);
      }
    }
  }
}

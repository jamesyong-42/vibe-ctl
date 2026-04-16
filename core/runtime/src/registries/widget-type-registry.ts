/**
 * WidgetTypeRegistry. Spec 02 §7.
 *
 * Stores widget definitions registered by plugins via `ctx.widgets.register()`.
 * When the ECS world is available, each registered widget type also creates an
 * entity with the `WidgetType` component so reactive queries in the shell can
 * drive the widget tray, canvas rendering, and missing-plugin placeholders.
 */

import type { Disposable, Logger, WidgetDef } from '@vibe-ctl/plugin-api';
import { WidgetType as WidgetTypeComponent } from '../ecs/components.js';
import type { KernelWorld } from '../ecs/world.js';

interface WidgetTypeEntry {
  def: WidgetDef;
  /** ECS entity id, if the world was provided. */
  entity?: number;
}

export class WidgetTypeRegistry {
  readonly #entries = new Map<string, WidgetTypeEntry>();
  readonly #world: KernelWorld | undefined;
  readonly #logger: Logger | undefined;

  constructor(opts?: { world?: KernelWorld; logger?: Logger }) {
    this.#world = opts?.world;
    this.#logger = opts?.logger;
  }

  /** Register a widget definition. Returns a Disposable that removes it. */
  register(def: WidgetDef): Disposable {
    const key = `${def.ownedByPlugin}:${def.type}`;

    if (this.#entries.has(key)) {
      this.#logger?.warn({ widgetType: key }, 'widget type already registered — overwriting');
      // Clean up the old ECS entity if it exists.
      const old = this.#entries.get(key);
      if (old?.entity != null && this.#world) {
        this.#world.destroyEntity(old.entity);
      }
    }

    const entry: WidgetTypeEntry = { def };

    // Create an ECS entity if the world is available.
    if (this.#world) {
      const entity = this.#world.createEntity();
      this.#world.addComponent(entity, WidgetTypeComponent, {
        type: def.type,
        ownedByPlugin: def.ownedByPlugin,
        placements: def.placements as string[],
        component: def.component,
        configSchema: def.configSchema ?? null,
      });
      entry.entity = entity;
    }

    this.#entries.set(key, entry);

    return {
      dispose: () => {
        const current = this.#entries.get(key);
        if (current === entry) {
          this.#entries.delete(key);
          if (entry.entity != null && this.#world) {
            this.#world.destroyEntity(entry.entity);
          }
        }
      },
    };
  }

  /** Get a widget definition by its fully-qualified type key. */
  get(type: string): WidgetDef | undefined {
    // Search by both raw type and namespaced key.
    const entry = this.#entries.get(type);
    if (entry) return entry.def;

    // Fallback: search by widget type (without plugin prefix).
    for (const [, e] of this.#entries) {
      if (e.def.type === type) return e.def;
    }
    return undefined;
  }

  /** Get all registered widget definitions. */
  getAll(): WidgetDef[] {
    return Array.from(this.#entries.values()).map((e) => e.def);
  }
}

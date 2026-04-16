/**
 * ServiceRegistry. Spec 01 §7, spec 02 §11.2.
 *
 * Invariant: exactly one instance of each service, accessed through the
 * registry. `provide` registers an implementation; `require` / `optional`
 * hand out direct refs for now (proxy + permission gating lands later).
 *
 * When the ECS world is available, each registered service also creates an
 * entity with the `ServiceEntry` component so reactive queries in the
 * shell can observe service state changes.
 */

import type { Disposable, Logger, PluginTier } from '@vibe-ctl/plugin-api';
import { ServiceUnavailable } from '@vibe-ctl/plugin-api';
import { ServiceEntry as ServiceEntryComponent } from '../ecs/components.js';
import type { KernelWorld } from '../ecs/world.js';

export interface ProvideOpts {
  warmup?: Promise<void>;
  tierRestriction?: PluginTier;
}

export interface ServiceEntryRecord<T = unknown> {
  id: string;
  version: string;
  providerId: string;
  impl: T;
  warmup?: Promise<void>;
  tierRestriction?: PluginTier;
  ready: boolean;
  /** ECS entity id, if the world was provided. */
  entity?: number;
}

export class ServiceRegistry {
  readonly #entries = new Map<string, ServiceEntryRecord>();
  readonly #world: KernelWorld | undefined;
  readonly #logger: Logger | undefined;

  constructor(opts?: { world?: KernelWorld; logger?: Logger }) {
    this.#world = opts?.world;
    this.#logger = opts?.logger;
  }

  /**
   * Register a service implementation. Returns a Disposable that removes it.
   */
  provide<T>(id: string, impl: T, opts?: ProvideOpts, providerId?: string): Disposable {
    const hasWarmup = opts?.warmup != null;
    const entry: ServiceEntryRecord<T> = {
      id,
      version: '1.0.0',
      providerId: providerId ?? 'unknown',
      impl,
      warmup: opts?.warmup,
      tierRestriction: opts?.tierRestriction,
      ready: !hasWarmup,
    };

    // Create an ECS entity if the world is available.
    if (this.#world) {
      const entity = this.#world.createEntity();
      this.#world.addComponent(entity, ServiceEntryComponent, {
        id,
        version: entry.version,
        providerId: entry.providerId,
        warmup: hasWarmup,
        tierRestriction: opts?.tierRestriction ?? '',
      });
      entry.entity = entity;
    }

    this.#entries.set(id, entry as ServiceEntryRecord);

    // If warmup is provided, mark ready when it resolves.
    if (opts?.warmup) {
      opts.warmup
        .then(() => {
          const current = this.#entries.get(id);
          if (current) {
            current.ready = true;
          }
        })
        .catch((err) => {
          this.#logger?.warn({ serviceId: id, err: String(err) }, 'service warmup failed');
        });
    }

    return {
      dispose: () => {
        this.#entries.delete(id);
        if (entry.entity != null && this.#world) {
          this.#world.destroyEntity(entry.entity);
        }
      },
    };
  }

  /**
   * Require a service. Throws `ServiceUnavailable` if the ID is not
   * registered.
   *
   * No proxy yet — direct refs. Proxy lands with permissions (Phase 6+).
   */
  require<T>(id: string): T {
    const entry = this.#entries.get(id);
    if (!entry) {
      throw new ServiceUnavailable(id);
    }
    return entry.impl as T;
  }

  /** Like require, but returns null if the service is not registered. */
  optional<T>(id: string): T | null {
    const entry = this.#entries.get(id);
    return entry ? (entry.impl as T) : null;
  }

  /** Check if warmup is complete for a given service. */
  isReady(id: string): boolean {
    const entry = this.#entries.get(id);
    return entry?.ready ?? false;
  }

  /** Check if a service is registered. */
  has(id: string): boolean {
    return this.#entries.has(id);
  }

  /** Mark all services from a given provider as invalidated (removed). */
  invalidateProvider(providerId: string): void {
    for (const [id, entry] of this.#entries) {
      if (entry.providerId === providerId) {
        this.#entries.delete(id);
        if (entry.entity != null && this.#world) {
          this.#world.destroyEntity(entry.entity);
        }
      }
    }
  }

  /** List all currently-registered services. */
  list(): ServiceEntryRecord[] {
    return Array.from(this.#entries.values());
  }
}

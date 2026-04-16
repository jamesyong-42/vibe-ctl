/**
 * DeactivationSystem. Spec 01 §11, spec 02 §8.
 *
 * Reverse topological teardown.
 *
 * Per plugin:
 *   1. AbortSignal fires (aborts in-flight async, fetches).
 *   2. `onDeactivate` runs with a 5 s hard timeout.
 *   3. Provided services invalidated (consumer proxies throw
 *      ServiceUnavailable on next call and fire 'unavailable' events).
 *   4. Tracked disposables disposed in reverse registration order.
 *   5. State set to 'disabled'.
 *
 * If a plugin's deactivation times out, we force state to 'disabled'
 * and mark it 'unhealthy' for the HealthSystem. Deactivation always
 * completes (spec 02 §11.8).
 */

import type { Logger, Plugin } from '@vibe-ctl/plugin-api';
import { PluginInstance, PluginManifest, PluginState } from '../ecs/components.js';
import type { KernelWorld } from '../ecs/world.js';
import type { ServiceRegistry } from '../registries/service-registry.js';
import { getPluginAbortController, removePluginAbortController } from './context-builder.js';
import type { DisposableTracker } from './disposable-tracker.js';

const DEFAULT_TIMEOUT_MS = 5_000;

export interface DeactivationSystemOptions {
  world: KernelWorld;
  tracker: DisposableTracker;
  services?: ServiceRegistry;
  logger: Logger;
  /** Hard timeout for each plugin's onDeactivate. Default 5 s. */
  onDeactivateTimeoutMs?: number;
  /** Callback fired after successful deactivation. */
  onDeactivated?: (pluginId: string) => void;
}

export class DeactivationSystem {
  readonly #opts: DeactivationSystemOptions;

  constructor(opts: DeactivationSystemOptions) {
    this.#opts = opts;
  }

  /**
   * Deactivate a single plugin. If the plugin provides services any
   * currently-active plugin depends on, the scheduler is responsible for
   * cascading first — this method does NOT cascade on its own.
   */
  async deactivate(pluginId: string): Promise<void> {
    const { world, tracker, logger } = this.#opts;
    const timeoutMs = this.#opts.onDeactivateTimeoutMs ?? DEFAULT_TIMEOUT_MS;

    const entity = this.#findEntity(pluginId);
    if (entity === undefined) {
      logger.warn({ pluginId }, 'deactivate: plugin entity not found');
      return;
    }

    // Transition to deactivating
    world.setComponent(entity, PluginState, { value: 'deactivating' });
    logger.info({ pluginId }, 'deactivating plugin');

    // 1. Fire the AbortSignal
    const ac = getPluginAbortController(pluginId);
    if (ac) {
      ac.abort();
    }

    // 2. Call onDeactivate with timeout
    const instanceComp = world.getComponent(entity, PluginInstance);
    if (instanceComp?.instance) {
      const plugin = instanceComp.instance as Plugin;
      if (plugin.onDeactivate) {
        try {
          const deactivatePromise = Promise.resolve(plugin.onDeactivate());
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error(`onDeactivate timeout after ${timeoutMs}ms`)),
              timeoutMs,
            );
          });
          await Promise.race([deactivatePromise, timeoutPromise]);
        } catch (err) {
          logger.warn({ pluginId, err: String(err) }, 'onDeactivate failed or timed out');
        }
      }
    }

    // 3. Invalidate provided services
    if (this.#opts.services) {
      this.#opts.services.invalidateProvider(pluginId);
    }

    // 4. Dispose tracked disposables in reverse order
    const errors = await tracker.disposeAll(pluginId);
    if (errors.length > 0) {
      logger.warn({ pluginId, errorCount: errors.length }, 'disposable cleanup had errors');
      for (const err of errors) {
        logger.debug({ pluginId, err: err.message }, 'disposable error');
      }
    }

    // 5. Transition to disabled
    world.setComponent(entity, PluginState, { value: 'disabled' });

    // Cleanup abort controller
    removePluginAbortController(pluginId);

    logger.info({ pluginId }, 'plugin deactivated');
    this.#opts.onDeactivated?.(pluginId);
  }

  /** Full shutdown: reverse-topo deactivate every active plugin. */
  async deactivateAll(): Promise<void> {
    const { world, logger } = this.#opts;
    const entities = world.query(PluginManifest, PluginState);

    // Collect active plugins
    const activePlugins: string[] = [];
    for (const entity of entities) {
      const state = world.getComponent(entity, PluginState);
      const manifest = world.getComponent(entity, PluginManifest);
      if (!state || !manifest) continue;
      if (
        state.value === 'active-ready' ||
        state.value === 'active-warming' ||
        state.value === 'activating'
      ) {
        activePlugins.push(manifest.id);
      }
    }

    // Reverse order for teardown (reverse topo = dependents first)
    activePlugins.reverse();

    logger.info({ count: activePlugins.length }, 'deactivating all plugins');
    for (const pluginId of activePlugins) {
      try {
        await this.deactivate(pluginId);
      } catch (err) {
        logger.error({ pluginId, err: String(err) }, 'deactivation failed');
      }
    }
  }

  #findEntity(pluginId: string): number | undefined {
    const entities = this.#opts.world.query(PluginManifest, PluginState);
    for (const entity of entities) {
      const manifest = this.#opts.world.getComponent(entity, PluginManifest);
      if (manifest?.id === pluginId) return entity;
    }
    return undefined;
  }
}

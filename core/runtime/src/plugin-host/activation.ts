/**
 * ActivationScheduler + ActivationSystem. Spec 01 §10, spec 02 §8.
 *
 * Two concerns:
 *   1. Scheduling (when does a plugin activate?) — eager at boot, lazy on
 *      first `services.require`, first widget placed, first command executed.
 *   2. Execution (how does a plugin activate?) — load module, construct
 *      Plugin instance, build PluginContext, call onActivate, attach
 *      warmup promise, record disposables.
 *
 * State machine:
 *   discovered → activating → active-warming → active-ready
 *                          \
 *                           → error (cascade disables dependents — spec 02 §9)
 */

import type { Logger, Plugin } from '@vibe-ctl/plugin-api';
import {
  PluginInstance,
  PluginManifest,
  PluginModule,
  PluginSource,
  PluginState,
  PluginTier,
} from '../ecs/components.js';
import { Eager, Failed } from '../ecs/tags.js';
import type { KernelWorld } from '../ecs/world.js';
import type { ContextBuilder } from './context-builder.js';
import type { DisposableTracker } from './disposable-tracker.js';

export interface ActivationSchedulerOptions {
  world: KernelWorld;
  /** Plugins currently scheduled for activation, in topological order. */
  order: string[];
  system: ActivationSystem;
  logger: Logger;
}

/**
 * Decides *when* to activate a plugin. Eager list is walked at boot;
 * triggers for lazy activation are registered at discovery time (service
 * require, widget placement, command invoke).
 */
export class ActivationScheduler {
  readonly #opts: ActivationSchedulerOptions;

  constructor(opts: ActivationSchedulerOptions) {
    this.#opts = opts;
  }

  /** Activate all eager plugins in topo order. */
  async activateEager(): Promise<void> {
    const { world, order, system, logger } = this.#opts;

    for (const pluginId of order) {
      const entity = this.#findEntity(pluginId);
      if (entity === undefined) continue;

      // Only activate eager plugins at boot.
      if (!world.hasTag(entity, Eager)) continue;

      const state = world.getComponent(entity, PluginState);
      if (!state || state.value !== 'discovered') continue;

      try {
        await system.activate(pluginId);
      } catch (err) {
        logger.error({ pluginId, err: String(err) }, 'eager activation failed');
      }
    }
  }

  /** Ensure a plugin is active; no-op if already active-ready or active-warming. */
  async ensureActive(pluginId: string): Promise<void> {
    const entity = this.#findEntity(pluginId);
    if (entity === undefined) return;

    const state = this.#opts.world.getComponent(entity, PluginState);
    if (!state) return;

    if (
      state.value === 'active-ready' ||
      state.value === 'active-warming' ||
      state.value === 'activating'
    ) {
      return;
    }

    if (state.value === 'discovered') {
      await this.#opts.system.activate(pluginId);
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

  /** Expose the options for debugging. */
  get options(): Readonly<ActivationSchedulerOptions> {
    return this.#opts;
  }
}

export interface ActivationSystemOptions {
  world: KernelWorld;
  contextBuilder: ContextBuilder;
  tracker: DisposableTracker;
  logger: Logger;
  /** Callback fired after successful activation. */
  onActivated?: (pluginId: string) => void;
}

/**
 * Performs the actual load+activate of a single plugin. Called by the
 * scheduler. Encapsulated as a system so it can observe ECS component
 * transitions (state: discovered → activating).
 */
export class ActivationSystem {
  readonly #opts: ActivationSystemOptions;

  constructor(opts: ActivationSystemOptions) {
    this.#opts = opts;
  }

  /**
   * One-shot activation for a specific plugin. Constructs ctx, loads the
   * module (and the utilityProcess main half for split plugins), calls
   * onActivate, records the warmup promise if any.
   */
  async activate(pluginId: string): Promise<void> {
    const { world, contextBuilder, logger } = this.#opts;
    const entity = this.#findEntity(pluginId);
    if (entity === undefined) {
      throw new Error(`Plugin entity not found: ${pluginId}`);
    }

    const manifest = world.getComponent(entity, PluginManifest);
    const source = world.getComponent(entity, PluginSource);
    const tier = world.getComponent(entity, PluginTier);
    if (!manifest || !source || !tier) {
      throw new Error(`Plugin entity missing required components: ${pluginId}`);
    }

    // Transition: discovered → activating
    world.setComponent(entity, PluginState, { value: 'activating' });
    logger.info({ pluginId }, 'activating plugin');

    try {
      // Resolve entry path
      const entryPath = this.#resolveEntryPath(manifest, source.path);

      // Dynamic import the plugin module
      const mod = await import(/* @vite-ignore */ entryPath);
      world.addComponent(entity, PluginModule, { module: mod, path: entryPath });

      // Get the Plugin class (default export)
      const PluginClass = mod.default as new () => Plugin;
      if (!PluginClass || typeof PluginClass !== 'function') {
        throw new Error(`Plugin module has no default export class: ${pluginId}`);
      }

      // Instantiate the Plugin class
      const instance = new PluginClass();

      // Build and inject context
      const ctx = contextBuilder.build(pluginId, manifest.version, tier.value);
      Object.defineProperty(instance, 'ctx', { value: ctx, writable: false });

      // Store the instance on the entity
      world.addComponent(entity, PluginInstance, { instance });

      // Call onActivate
      const result = instance.onActivate();

      // If onActivate returned a promise, transition through warming states
      if (result instanceof Promise) {
        world.setComponent(entity, PluginState, { value: 'active-warming' });
        result
          .then(() => {
            world.setComponent(entity, PluginState, { value: 'active-ready' });
            logger.info({ pluginId }, 'plugin activation complete (warmup done)');
          })
          .catch((err) => {
            logger.error({ pluginId, err: String(err) }, 'plugin warmup failed');
            world.setComponent(entity, PluginState, { value: 'error' });
            world.addTag(entity, Failed);
          });
      } else {
        world.setComponent(entity, PluginState, { value: 'active-ready' });
        logger.info({ pluginId }, 'plugin activation complete');
      }

      this.#opts.onActivated?.(pluginId);
    } catch (err) {
      logger.error({ pluginId, err: String(err) }, 'plugin activation failed');
      world.setComponent(entity, PluginState, { value: 'error' });
      world.addTag(entity, Failed);
    }
  }

  #resolveEntryPath(
    manifest: { executionContext: string; id: string },
    sourcePath: string,
  ): string {
    // For renderer-only or split (renderer half), use the renderer entry.
    // For main-only, use the main entry. The actual entry is declared in
    // the manifest but we use the source path to build the absolute path.
    // For now, we resolve to `dist/index.js` under the plugin directory.
    // Split plugin main-half loading is wired in Phase 6.
    return `${sourcePath}/dist/index.js`;
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

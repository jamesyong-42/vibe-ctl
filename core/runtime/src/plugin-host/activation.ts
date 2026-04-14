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
 *   loaded → activating → active-warming → active-ready
 *                     \
 *                      → error (cascade disables dependents — spec 02 §9)
 */

import type { KernelWorld } from '../ecs/world.js';
import type { ContextBuilder } from './context-builder.js';
import type { DisposableTracker } from './disposable-tracker.js';

export interface ActivationSchedulerOptions {
  world: KernelWorld;
  /** Plugins currently scheduled for activation, in topological order. */
  order: string[];
  system: ActivationSystem;
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
    throw new Error('not implemented: ActivationScheduler.activateEager');
  }

  /** Ensure a plugin is active; no-op if already active-ready. */
  async ensureActive(_pluginId: string): Promise<void> {
    throw new Error('not implemented: ActivationScheduler.ensureActive');
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
}

/**
 * Performs the actual load+activate of a single plugin. Called by the
 * scheduler. Encapsulated as a system so it can observe ECS component
 * transitions (state: loaded → activating).
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
  async activate(_pluginId: string): Promise<void> {
    throw new Error('not implemented: ActivationSystem.activate');
  }
}

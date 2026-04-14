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

import type { KernelWorld } from '../ecs/world.js';
import type { DisposableTracker } from './disposable-tracker.js';

export interface DeactivationSystemOptions {
  world: KernelWorld;
  tracker: DisposableTracker;
  /** Hard timeout for each plugin's onDeactivate. Default 5 s. */
  onDeactivateTimeoutMs?: number;
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
  async deactivate(_pluginId: string): Promise<void> {
    throw new Error('not implemented: DeactivationSystem.deactivate');
  }

  /** Full shutdown: reverse-topo deactivate every active plugin. */
  async deactivateAll(): Promise<void> {
    throw new Error('not implemented: DeactivationSystem.deactivateAll');
  }
}

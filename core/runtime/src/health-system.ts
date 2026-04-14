/**
 * HealthSystem. Spec 02 §7 (HealthMonitorSystem).
 *
 * Watches for:
 *   - Repeated crashes in a split plugin's main half. Per spec 01
 *     decisions: "auto-restart up to 3× with exponential backoff, then
 *     mark Failed." User re-enables manually from plugin manager.
 *   - Plugins stuck in `activating` beyond a threshold.
 *   - Plugins emitting `plugin.error` at a high rate.
 *
 * Auto-disables misbehaving plugins by setting the `Disabled` tag and
 * transitioning state to `error` / `disabled`. Other plugins depending on
 * a service provider get the cascade treatment (spec 02 decisions:
 * silent cascade with user notification).
 */

import type { Logger } from '@vibe-ctl/plugin-api';
import type { KernelWorld } from './ecs/world.js';

export interface HealthSystemOptions {
  world: KernelWorld;
  logger: Logger;
  /** Max restart attempts for a crashing split-plugin main half. Default 3. */
  maxRestarts?: number;
}

export class HealthSystem {
  readonly #opts: HealthSystemOptions;

  constructor(opts: HealthSystemOptions) {
    this.#opts = opts;
  }

  /** Record a plugin error; may trigger auto-disable. */
  recordError(_pluginId: string, _error: Error): void {
    throw new Error('not implemented: HealthSystem.recordError');
  }

  /** Record a restart attempt; returns whether further restarts are allowed. */
  recordRestart(_pluginId: string): boolean {
    throw new Error('not implemented: HealthSystem.recordRestart');
  }

  /** Reset health counters on user-initiated enable. */
  reset(_pluginId: string): void {
    throw new Error('not implemented: HealthSystem.reset');
  }
}

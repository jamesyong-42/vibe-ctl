/**
 * SettingsManager. Spec 01 §5 (ctx.settings), spec 02 §4.
 *
 * Reads and writes `kernel/user-settings` (a Loro Map keyed by
 * `{pluginId}.{key}`). Per spec 01's "only ctx.settings.* accesses synced
 * user settings" decision, this is the sole path for plugin settings.
 *
 * Per-plugin `ctx.settings` façades scope key names to `{pluginId}.*`
 * automatically; this manager enforces that on writes as a defence in depth.
 */

import type { Disposable } from '@vibe-ctl/plugin-api';
import type { KernelDocs } from './sync/kernel-docs.js';

export interface SettingsManagerOptions {
  docs: KernelDocs;
}

export class SettingsManager {
  readonly #opts: SettingsManagerOptions;

  constructor(opts: SettingsManagerOptions) {
    this.#opts = opts;
  }

  get<T = unknown>(_pluginId: string, _key: string): T | undefined {
    throw new Error('not implemented: SettingsManager.get');
  }

  update<T = unknown>(_pluginId: string, _key: string, _value: T): void {
    throw new Error('not implemented: SettingsManager.update');
  }

  onChange(_pluginId: string, _key: string, _cb: (value: unknown) => void): Disposable {
    throw new Error('not implemented: SettingsManager.onChange');
  }

  /** Expose options to sibling modules (e.g. ContextBuilder). */
  get options(): Readonly<SettingsManagerOptions> {
    return this.#opts;
  }
}

/**
 * Dev hot-reload. Spec 02 §8 (dev workflow).
 *
 * Watches dev-symlinked plugin dirs with chokidar. On `dist/` change:
 *   1. Reverse-topo deactivate the plugin.
 *   2. Invalidate its import cache.
 *   3. Re-run discovery (manifest might have changed).
 *   4. Re-activate.
 *
 * Off by default; only wired when `devPluginRoots` is non-empty.
 */

import type { Logger } from '@vibe-ctl/plugin-api';

export interface HotReloaderOptions {
  devPluginRoots: string[];
  logger: Logger;
  /** Fired when a reload cycle should be performed for a plugin. */
  onReload: (pluginId: string) => Promise<void>;
}

export class HotReloader {
  readonly #opts: HotReloaderOptions;
  // chokidar handle owned here; typed as unknown until we need the fine
  // surface (wraps FSWatcher).
  #watcher: unknown | null = null;

  constructor(opts: HotReloaderOptions) {
    this.#opts = opts;
  }

  /** Start watching. Idempotent. */
  async start(): Promise<void> {
    throw new Error('not implemented: HotReloader.start');
  }

  /** Stop watching. Idempotent. */
  async stop(): Promise<void> {
    if (!this.#watcher) return;
    throw new Error('not implemented: HotReloader.stop');
  }
}

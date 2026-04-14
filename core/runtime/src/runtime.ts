/**
 * The kernel Runtime.
 *
 * Owns the three kernel layers from spec 02:
 *   - Layer 2 Sync Fabric (truffle NapiNode + four kernel-managed docs).
 *   - Layer 3 Plugin Host (discovery, resolution, activation, deactivation).
 *   - The kernel ECS world that mirrors sync state as reactive components.
 *
 * The platform layer (Electron shell, windows, canvas substrate) lives in
 * `@vibe-ctl/shell` and `@vibe-ctl/canvas` and constructs the Runtime,
 * never the other way round.
 *
 * Follows the bootstrap sequence of spec 02 §10.
 */

import type { Logger } from '@vibe-ctl/extension-api';
import type { KernelWorld } from './ecs/world.js';
import type {
  DiscoveryResult,
  PluginInfo,
  PluginState,
  ResolutionResult,
  RuntimeOptions,
} from './types.js';

export type { RuntimeOptions } from './types.js';

export class Runtime {
  readonly #opts: RuntimeOptions;
  readonly #logger: Logger;

  /** Lazily initialised on start(). */
  #world: KernelWorld | null = null;
  #started = false;

  constructor(opts: RuntimeOptions) {
    this.#opts = opts;
    this.#logger = opts.logger;
    // Intentional: no heavy work in the constructor. All I/O, NapiNode
    // creation, doc opening, and ECS world materialisation happens in start().
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Scan plugin dirs (built-in, user, dev) and parse manifests into ECS
   * entities. Does NOT activate. Corresponds to step 6 of the bootstrap
   * sequence in spec 02 §10.
   */
  async discover(): Promise<DiscoveryResult> {
    throw new Error('not implemented: Runtime.discover');
  }

  /**
   * Topologically resolve dependencies across discovered plugins. Produces
   * an activation order or a list of unresolved reasons (cycles, missing
   * non-optional deps, incompatible semver). Handled in the
   * `DependencyResolutionSystem`.
   */
  async resolve(): Promise<ResolutionResult> {
    throw new Error('not implemented: Runtime.resolve');
  }

  /**
   * Full kernel bootstrap. Steps, in order:
   *   1. Start sync fabric (NapiNode, four kernel docs, wait briefly for
   *      first deltas — non-blocking).
   *   2. Run the kernel version gate; abort with "update required" if this
   *      app is behind any peer.
   *   3. Create the kernel ECS world and register kernel systems.
   *   4. Discover + resolve plugins.
   *   5. Activate eager plugins in topological order.
   */
  async start(): Promise<void> {
    if (this.#started) return;
    throw new Error('not implemented: Runtime.start');
  }

  /**
   * Reverse-topological teardown. Fires AbortSignals, runs each plugin's
   * onDeactivate (5s timeout), invalidates provided services, disposes
   * tracked disposables, closes sync docs, stops the NapiNode.
   */
  async stop(): Promise<void> {
    if (!this.#started) return;
    throw new Error('not implemented: Runtime.stop');
  }

  // ─── Plugin control (user-initiated or programmatic) ────────────────

  async enablePlugin(_id: string): Promise<void> {
    throw new Error('not implemented: Runtime.enablePlugin');
  }

  async disablePlugin(_id: string): Promise<void> {
    throw new Error('not implemented: Runtime.disablePlugin');
  }

  // ─── Introspection ──────────────────────────────────────────────────

  /** Projected view of all plugin entities currently known to the kernel. */
  queryPlugins(): PluginInfo[] {
    return [];
  }

  /** Returns null if the plugin is not known to the kernel. */
  getPluginState(_id: string): PluginState | null {
    return null;
  }

  // ─── Internals exposed to sibling kernel modules ────────────────────

  /** The kernel ECS world. Internal; plugins never query this directly. */
  get world(): KernelWorld {
    if (!this.#world) {
      throw new Error('Runtime.world accessed before start()');
    }
    return this.#world;
  }

  /** The kernel logger, scoped to 'runtime'. */
  get logger(): Logger {
    return this.#logger;
  }

  /** Access to the full options bag for sibling modules that need it. */
  get options(): Readonly<RuntimeOptions> {
    return this.#opts;
  }
}

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
 * never the other way round. In the tri-process topology (spec 05 §2) the
 * runtime does not fork the kernel utility itself — the shell does, and
 * passes a Comlink-wrapped `KernelCtrl` in via `RuntimeOptions.kernelCtrl`.
 *
 * Follows the bootstrap sequence of spec 02 §10.
 */

import type { Logger } from '@vibe-ctl/plugin-api';
import type { DiscoveryResult, PluginInfo, PluginState, ResolutionResult } from '../types.js';
import type { RuntimeOptions } from './options.js';

export class Runtime {
  readonly #opts: RuntimeOptions;
  readonly #logger: Logger;
  #started = false;

  constructor(opts: RuntimeOptions) {
    this.#opts = opts;
    this.#logger = opts.logger;
    // Intentional: no heavy work in the constructor. All I/O, NapiNode
    // creation, doc opening, and ECS world materialisation happens in
    // start() — once the shell has forked the kernel utility and handed
    // us the ctrl proxy.
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Scan plugin dirs (built-in, user, dev) and parse manifests into ECS
   * entities. Does NOT activate. Corresponds to step 6 of the bootstrap
   * sequence in spec 02 §10.
   *
   * Phase-1 stub — real implementation lives in `DiscoverySystem`
   * (spec 02 §7). Kept as a viable no-op so the shell's dev loop can run
   * end-to-end while the plugin host is being built out (Phase 3).
   */
  async discover(): Promise<DiscoveryResult> {
    this.#logger.warn('[runtime] discover(): stub — returning empty result');
    return { discovered: [], errors: [] };
  }

  /**
   * Topologically resolve dependencies across discovered plugins. Produces
   * an activation order or a list of unresolved reasons (cycles, missing
   * non-optional deps, incompatible semver). Phase-1 stub.
   */
  async resolve(): Promise<ResolutionResult> {
    this.#logger.warn('[runtime] resolve(): stub — returning empty result');
    return { activationOrder: [], unresolved: [] };
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
   *
   * Phase-1 wiring lives in commit 10; this commit only marks started
   * so stop() pairs cleanly.
   */
  async start(): Promise<void> {
    if (this.#started) return;
    const ctrl = this.#opts.kernelCtrl;
    if (ctrl) {
      await ctrl.start();
      const version = await ctrl.getVersion();
      this.#logger.info('[runtime] kernel utility ready', { kernelUtilityVersion: version });
    } else {
      this.#logger.warn('[runtime] start(): no kernelCtrl provided — Phase 1 dev-only path');
    }
    this.#started = true;
  }

  /**
   * Reverse-topological teardown. Fires AbortSignals, runs each plugin's
   * onDeactivate (5s timeout), invalidates provided services, disposes
   * tracked disposables, closes sync docs, stops the NapiNode.
   */
  async stop(): Promise<void> {
    if (!this.#started) return;
    try {
      await this.#opts.kernelCtrl?.stop();
    } catch (err) {
      this.#logger.warn('[runtime] kernelCtrl.stop() threw', { err: String(err) });
    }
    this.#started = false;
  }

  // ─── Plugin control (user-initiated or programmatic) ────────────────

  async enablePlugin(_id: string): Promise<void> {
    throw new Error('not implemented: Runtime.enablePlugin');
  }

  async disablePlugin(_id: string): Promise<void> {
    throw new Error('not implemented: Runtime.disablePlugin');
  }

  // ─── Introspection ──────────────────────────────────────────────────

  queryPlugins(): PluginInfo[] {
    return [];
  }

  getPluginState(_id: string): PluginState | null {
    return null;
  }

  // ─── Internals exposed to sibling kernel modules ────────────────────

  /** The kernel logger, scoped to 'runtime'. */
  get logger(): Logger {
    return this.#logger;
  }

  /** Access to the full options bag for sibling modules that need it. */
  get options(): Readonly<RuntimeOptions> {
    return this.#opts;
  }
}

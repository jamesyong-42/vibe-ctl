/**
 * ContextBuilder. Constructs a `PluginContext` for each plugin at
 * activation time. Spec 01 §5.
 *
 * The context is scoped to one plugin: disposables auto-track to the
 * DisposableTracker under that plugin's ID, `ctx.logger` is scoped to the
 * plugin, `ctx.signal` aborts on deactivation, and the sync/mesh façades
 * auto-namespace wire traffic with the plugin ID (so no plugin can
 * impersonate another).
 */

import type { Logger, PluginContext, PluginTier } from '@vibe-ctl/extension-api';
import type { CommandRegistry } from '../command-registry.js';
import type { PermissionManager } from '../permission-manager.js';
import type { ServiceRegistry } from '../service-registry.js';
import type { SettingsManager } from '../settings-manager.js';
import type { KernelDocs } from '../sync/kernel-docs.js';
import type { MeshNode } from '../sync/mesh-node.js';
import type { DisposableTracker } from './disposable-tracker.js';

export interface ContextBuilderOptions {
  mesh: MeshNode;
  docs: KernelDocs;
  services: ServiceRegistry;
  commands: CommandRegistry;
  settings: SettingsManager;
  permissions: PermissionManager;
  tracker: DisposableTracker;
  /** Root dir for per-plugin persistent storage. */
  pluginDataDir: (pluginId: string) => string;
  /** Root logger; scoped per plugin. */
  baseLogger: Logger;
  deviceId: string;
  deviceName: string;
}

export class ContextBuilder {
  readonly #opts: ContextBuilderOptions;

  constructor(opts: ContextBuilderOptions) {
    this.#opts = opts;
  }

  /**
   * Build a `PluginContext` for a specific plugin. The tier is passed in
   * rather than read from ECS so this method is cheap and side-effect-free.
   */
  build(_pluginId: string, _version: string, _tier: PluginTier): PluginContext {
    throw new Error('not implemented: ContextBuilder.build');
  }

  /** Access the wired options (used by a small number of sibling modules). */
  get options(): Readonly<ContextBuilderOptions> {
    return this.#opts;
  }
}

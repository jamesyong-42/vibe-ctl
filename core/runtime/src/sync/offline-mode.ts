/**
 * Offline mode controller. Spec 02 §9 last row.
 *
 * Backed by `kernel/user-settings` — users toggle:
 *   - `sync.enabled` — master switch; when false the NapiNode never starts.
 *   - `sync.categories.{canvas|settings|permissions|inventory}` — per-doc.
 *   - `sync.pluginOptOut` — array of plugin IDs whose per-plugin docs stay
 *     local.
 *
 * The OfflineMode class wraps a MeshNode and reads/writes the
 * `sync.offlineMode` key in `kernel/user-settings` via the SettingsManager.
 * enable()/disable() toggle the mesh connection at runtime.
 */

import { createScopedLogger } from '../logging/index.js';
import type { SettingsManager } from '../settings-manager.js';
import type { MeshNode } from './mesh-node.js';

const log = createScopedLogger('sync:offline-mode');

/** Settings key for the offline mode toggle. */
const OFFLINE_MODE_KEY = 'offlineMode';
const SETTINGS_PLUGIN_ID = 'sync';

export interface OfflineModeConfig {
  /** Master switch; if false, everything below is moot. */
  enabled: boolean;
  categories: {
    canvas: boolean;
    settings: boolean;
    permissions: boolean;
    inventory: boolean;
  };
  pluginOptOut: Set<string>;
}

export interface OfflineModeOptions {
  mesh: MeshNode;
  settings: SettingsManager;
}

export class OfflineMode {
  readonly #mesh: MeshNode;
  readonly #settings: SettingsManager;
  #offline: boolean;

  constructor(opts: OfflineModeOptions) {
    this.#mesh = opts.mesh;
    this.#settings = opts.settings;
    // Read initial state from settings.
    const stored = this.#settings.read<boolean>(SETTINGS_PLUGIN_ID, OFFLINE_MODE_KEY);
    this.#offline = stored === true;
  }

  /** Disconnect the MeshNode from the network. Docs become local-only. */
  async enable(): Promise<void> {
    if (this.#offline) return;
    this.#offline = true;
    this.#settings.write(SETTINGS_PLUGIN_ID, OFFLINE_MODE_KEY, true);
    await this.#mesh.stop();
    log.info('offline mode enabled');
  }

  /** Reconnect the MeshNode. Queued local deltas flush. */
  async disable(): Promise<void> {
    if (!this.#offline) return;
    this.#offline = false;
    this.#settings.write(SETTINGS_PLUGIN_ID, OFFLINE_MODE_KEY, false);
    await this.#mesh.start();
    log.info('offline mode disabled');
  }

  isOffline(): boolean {
    return this.#offline;
  }
}

/** Parse a raw settings record into OfflineModeConfig with defaults. */
export function resolveOfflineMode(raw: Record<string, unknown>): OfflineModeConfig {
  const enabled = raw['sync.enabled'] !== false; // default true
  const categories = {
    canvas: raw['sync.categories.canvas'] !== false,
    settings: raw['sync.categories.settings'] !== false,
    permissions: raw['sync.categories.permissions'] !== false,
    inventory: raw['sync.categories.inventory'] !== false,
  };
  const optOutRaw = raw['sync.pluginOptOut'];
  const pluginOptOut = new Set<string>(Array.isArray(optOutRaw) ? (optOutRaw as string[]) : []);
  return { enabled, categories, pluginOptOut };
}

/** True if the given kernel-owned doc should sync under this config. */
export function shouldSyncKernelDoc(
  cfg: OfflineModeConfig,
  doc: 'canvas-layout' | 'user-settings' | 'permissions' | 'plugin-inventory',
): boolean {
  if (!cfg.enabled) return false;
  switch (doc) {
    case 'canvas-layout':
      return cfg.categories.canvas;
    case 'user-settings':
      return cfg.categories.settings;
    case 'permissions':
      return cfg.categories.permissions;
    case 'plugin-inventory':
      return cfg.categories.inventory;
  }
}

/** True if the given plugin's per-plugin sync docs should participate. */
export function shouldSyncPlugin(cfg: OfflineModeConfig, pluginId: string): boolean {
  if (!cfg.enabled) return false;
  return !cfg.pluginOptOut.has(pluginId);
}

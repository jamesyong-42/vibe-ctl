/**
 * Offline mode controller. Spec 02 §9 last row.
 *
 * Backed by `kernel/user-settings` — users toggle:
 *   - `sync.enabled` — master switch; when false the NapiNode never starts.
 *   - `sync.categories.{canvas|settings|permissions|inventory}` — per-doc.
 *   - `sync.pluginOptOut` — array of plugin IDs whose per-plugin docs stay
 *     local.
 *
 * This module is stateless: it reads the current settings snapshot and
 * reports which docs/plugins should sync. The actual wiring (skip opening
 * docs vs. open-but-don't-publish) is done by KernelDocs + the per-plugin
 * sync provisioner.
 */

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

/** Parse a raw settings record into OfflineModeConfig with defaults. */
export function resolveOfflineMode(_raw: Record<string, unknown>): OfflineModeConfig {
  throw new Error('not implemented: resolveOfflineMode');
}

/** True if the given kernel-owned doc should sync under this config. */
export function shouldSyncKernelDoc(
  _cfg: OfflineModeConfig,
  _doc: 'canvas-layout' | 'user-settings' | 'permissions' | 'plugin-inventory',
): boolean {
  throw new Error('not implemented: shouldSyncKernelDoc');
}

/** True if the given plugin's per-plugin sync docs should participate. */
export function shouldSyncPlugin(_cfg: OfflineModeConfig, _pluginId: string): boolean {
  throw new Error('not implemented: shouldSyncPlugin');
}

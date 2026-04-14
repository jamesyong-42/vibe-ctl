/**
 * Plugin module install. Part of module-resolver.
 *
 * Responsibilities:
 *   - Copy a plugin package into `{userData}/plugins/` after download.
 *   - Verify manifest shape before copy.
 *   - Create a fresh ECS entity in state='discovered'.
 *
 * Downloaded tarballs and integrity checks are handled by the registry
 * code in apps/desktop (spec 04); this function takes an already-
 * extracted directory.
 */

export interface InstallOptions {
  /** Directory containing the extracted plugin (must have plugin.json at root). */
  sourceDir: string;
  /** Target: `{userData}/plugins/{pluginId}/`. */
  targetDir: string;
}

export async function installPlugin(_opts: InstallOptions): Promise<void> {
  throw new Error('not implemented: installPlugin');
}

export async function uninstallPlugin(_pluginId: string, _userPluginDir: string): Promise<void> {
  throw new Error('not implemented: uninstallPlugin');
}

/**
 * Plugin discovery. Spec 02 §8.
 *
 * Scans the three plugin directories in priority order:
 *   1. `{app.resources}/plugins/`  → built-in (T1)
 *   2. `{userData}/plugins/`       → user-installed (T2/T3)
 *   3. `$VIBE_CTL_DEV_PLUGINS`     → dev symlinks (T3, hot reload)
 *
 * For each plugin directory found, parses `plugin.json` with
 * `PluginManifestSchema` from @vibe-ctl/extension-api. Tier is assigned
 * from the source directory, never from the manifest.
 *
 * Emits ECS entities with the PluginManifest, PluginSource, and
 * PluginState='discovered' components. The DependencyResolutionSystem
 * picks them up next.
 */

import type { Logger } from '@vibe-ctl/extension-api';
import type { KernelWorld } from '../ecs/world.js';

export interface DiscoveryOptions {
  builtInPluginRoots: string[];
  userPluginDirs: string[];
  devPluginRoots: string[];
  world: KernelWorld;
  logger: Logger;
}

export interface DiscoveredPlugin {
  id: string;
  version: string;
  sourceKind: 'built-in' | 'user-installed' | 'dev-symlink';
  path: string;
}

/**
 * Walk the three roots, parse manifests, and populate the kernel ECS world
 * with plugin entities. Returns a summary plus any parse failures.
 */
export async function discoverPlugins(
  _opts: DiscoveryOptions,
): Promise<{ discovered: DiscoveredPlugin[]; errors: Array<{ path: string; error: Error }> }> {
  throw new Error('not implemented: discoverPlugins');
}

/**
 * Parse a single `plugin.json` file. Validates with the Zod schema from
 * @vibe-ctl/extension-api. Throws on invalid manifest; callers should
 * collect into the errors array rather than aborting discovery.
 */
export async function readManifest(_path: string): Promise<unknown> {
  throw new Error('not implemented: readManifest');
}

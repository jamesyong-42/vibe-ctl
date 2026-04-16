/**
 * Plugin discovery. Spec 02 §8.
 *
 * Scans the three plugin directories in priority order:
 *   1. `{app.resources}/plugins/`  → built-in (T1)
 *   2. `{userData}/plugins/`       → user-installed (T2/T3)
 *   3. `$VIBE_CTL_DEV_PLUGINS`     → dev symlinks (T3, hot reload)
 *
 * For each plugin directory found, parses `plugin.json` with
 * `PluginManifestSchema` from @vibe-ctl/plugin-api. Tier is assigned
 * from the source directory, never from the manifest.
 *
 * Emits ECS entities with the PluginManifest, PluginSource, and
 * PluginState='discovered' components. The DependencyResolutionSystem
 * picks them up next.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Logger, PluginManifest as PluginManifestType } from '@vibe-ctl/plugin-api';
import { parseManifest } from '@vibe-ctl/plugin-api';
import {
  PluginDeps,
  PluginDisposables,
  PluginHealth,
  PluginManifest,
  PluginPermissions,
  PluginProvidedServices,
  PluginRequiredServices,
  PluginSource,
  PluginState,
  PluginTier,
} from '../ecs/components.js';
import { Eager } from '../ecs/tags.js';
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

type SourceKind = 'built-in' | 'user-installed' | 'dev-symlink';

/**
 * Walk the three roots, parse manifests, and populate the kernel ECS world
 * with plugin entities. Returns a summary plus any parse failures.
 */
export async function discoverPlugins(
  opts: DiscoveryOptions,
): Promise<{ discovered: DiscoveredPlugin[]; errors: Array<{ path: string; error: Error }> }> {
  const discovered: DiscoveredPlugin[] = [];
  const errors: Array<{ path: string; error: Error }> = [];
  const seenIds = new Set<string>();

  const scanEntries: Array<{ roots: string[]; kind: SourceKind }> = [
    { roots: opts.builtInPluginRoots, kind: 'built-in' },
    { roots: opts.userPluginDirs, kind: 'user-installed' },
    { roots: opts.devPluginRoots, kind: 'dev-symlink' },
  ];

  for (const { roots, kind } of scanEntries) {
    for (const root of roots) {
      let entries: string[];
      try {
        entries = await fs.readdir(root);
      } catch {
        // Directory doesn't exist — skip silently. Common for fresh installs.
        continue;
      }

      for (const entry of entries) {
        const pluginDir = path.join(root, entry);
        const manifestPath = path.join(pluginDir, 'plugin.json');

        try {
          const stat = await fs.stat(pluginDir);
          if (!stat.isDirectory()) continue;
        } catch {
          continue;
        }

        try {
          const manifest = await readManifest(manifestPath);

          // Skip duplicate IDs — first occurrence wins (T1 > T2 > T3).
          if (seenIds.has(manifest.id)) {
            opts.logger.warn(
              { pluginId: manifest.id, path: pluginDir },
              'duplicate plugin id — skipping (first occurrence wins)',
            );
            continue;
          }
          seenIds.add(manifest.id);

          createPluginEntity(opts.world, manifest, pluginDir, kind);

          discovered.push({
            id: manifest.id,
            version: manifest.version,
            sourceKind: kind,
            path: pluginDir,
          });
        } catch (err) {
          errors.push({
            path: manifestPath,
            error: err instanceof Error ? err : new Error(String(err)),
          });
          opts.logger.warn(
            { path: manifestPath, err: String(err) },
            'invalid plugin manifest — skipping',
          );
        }
      }
    }
  }

  opts.logger.info(
    { count: discovered.length, errors: errors.length },
    'plugin discovery complete',
  );

  return { discovered, errors };
}

/**
 * Parse a single `plugin.json` file. Validates with the Zod schema from
 * @vibe-ctl/plugin-api. Throws on invalid manifest; callers should
 * collect into the errors array rather than aborting discovery.
 */
export async function readManifest(manifestPath: string): Promise<PluginManifestType> {
  const raw = await fs.readFile(manifestPath, 'utf-8');
  const json: unknown = JSON.parse(raw);
  return parseManifest(json);
}

/** Tier assignment per source kind. */
function tierFromSource(kind: SourceKind): 'T1' | 'T2' | 'T3' {
  switch (kind) {
    case 'built-in':
      return 'T1';
    case 'user-installed':
      return 'T2';
    case 'dev-symlink':
      return 'T3';
  }
}

/** Create a full plugin entity in the kernel ECS world with all base components. */
function createPluginEntity(
  world: KernelWorld,
  manifest: PluginManifestType,
  dir: string,
  kind: SourceKind,
): void {
  const entity = world.createEntity();

  // Determine the entry path string for the manifest component
  const entryStr = typeof manifest.entry === 'string' ? manifest.entry : '';

  world.addComponent(entity, PluginManifest, {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    executionContext: manifest.executionContext,
    eagerActivation: manifest.eagerActivation,
    description: manifest.description ?? '',
    provides: manifest.provides,
    dependencies: manifest.dependencies,
    optionalDependencies: manifest.optionalDependencies,
    waitForReady: manifest.waitForReady,
    permissions: manifest.permissions,
    hostProvided: manifest.hostProvided,
    sync: manifest.sync,
  });

  world.addComponent(entity, PluginSource, { kind, path: dir });
  world.addComponent(entity, PluginState, { value: 'discovered' });
  world.addComponent(entity, PluginTier, { value: tierFromSource(kind) });
  world.addComponent(entity, PluginHealth, {
    errorCount: 0,
    restartCount: 0,
    lastErrorAt: 0,
    lastRestartAt: 0,
  });
  world.addComponent(entity, PluginDeps, { requires: [], optional: [], dependents: [] });
  world.addComponent(entity, PluginDisposables, { count: 0 });
  world.addComponent(entity, PluginPermissions, {
    declared: manifest.permissions,
    granted: [],
    revoked: [],
  });

  // Build provided / required service component data from manifest
  const providedServices = Object.entries(manifest.provides).map(([id, version]) => ({
    id,
    version,
    ready: false,
  }));
  world.addComponent(entity, PluginProvidedServices, { services: providedServices });

  const requiredServices = [
    ...Object.entries(manifest.dependencies).map(([id, range]) => ({
      id,
      range,
      optional: false,
    })),
    ...Object.entries(manifest.optionalDependencies).map(([id, range]) => ({
      id,
      range,
      optional: true,
    })),
  ];
  world.addComponent(entity, PluginRequiredServices, { services: requiredServices });

  // Tag eager plugins
  if (manifest.eagerActivation) {
    world.addTag(entity, Eager);
  }
}

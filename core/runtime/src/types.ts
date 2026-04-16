/**
 * Internal types for @vibe-ctl/runtime.
 *
 * Public-facing plugin types live in `@vibe-ctl/plugin-api`. This module
 * holds kernel-internal shapes used across discovery, resolution, activation
 * and the ECS world.
 */

import type { PluginTier } from '@vibe-ctl/plugin-api';

/** Lifecycle state for a plugin entity in the kernel ECS world. */
export type PluginState =
  | 'discovered'
  | 'loaded'
  | 'activating'
  | 'active-warming'
  | 'active-ready'
  | 'deactivating'
  | 'disabled'
  | 'error';

/** Where a plugin was discovered from. Determines its tier. */
export type PluginSource =
  | { kind: 'built-in'; path: string }
  | { kind: 'user-installed'; path: string }
  | { kind: 'dev-symlink'; path: string };

/** Lightweight projection of a plugin entity, exposed via Runtime.queryPlugins(). */
export interface PluginInfo {
  id: string;
  version: string;
  tier: PluginTier;
  state: PluginState;
  sourcePath: string;
  provides: string[];
  requires: string[];
  eager: boolean;
}

/** Result of Runtime.discover(). */
export interface DiscoveryResult {
  discovered: PluginInfo[];
  errors: Array<{ path: string; error: Error }>;
}

/** Result of Runtime.resolve(). */
export interface ResolutionResult {
  /** Topologically ordered list of plugin IDs ready to activate. */
  activationOrder: string[];
  /** Plugins that failed resolution (cycles, missing deps, version mismatch). */
  unresolved: Array<{ pluginId: string; reason: string }>;
}

/**
 * Thin interface the runtime needs from the canvas engine. Kept minimal so
 * we don't couple `@vibe-ctl/runtime` to `@vibe-ctl/canvas` (which depends on
 * this package). The shell wires a real implementation at construction time.
 */
export interface CanvasEngineHandle {
  /** Opaque handle to the canvas-sync adapter registration target. */
  readonly registerWidgetType: (type: string, ownerPluginId: string) => void;
  readonly unregisterWidgetType: (type: string) => void;
}

// RuntimeOptions lives in ./main-api/options.ts (re-exported from index).

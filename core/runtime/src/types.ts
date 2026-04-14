/**
 * Internal types for @vibe-ctl/runtime.
 *
 * Public-facing plugin types live in `@vibe-ctl/extension-api`. This module
 * holds kernel-internal shapes used across discovery, resolution, activation
 * and the ECS world.
 */

import type { Logger, PluginTier } from '@vibe-ctl/extension-api';

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

/**
 * Aggregated construction options for the Runtime. Documented in detail on
 * `runtime.ts`.
 */
export interface RuntimeOptions {
  /** Directories scanned for user-installed plugins, in priority order. */
  pluginDirs: string[];
  /**
   * Directories scanned for built-in (T1) plugins. Typically
   * `{app.resources}/plugins/`.
   */
  builtInPluginRoots: string[];
  /**
   * Optional dev-symlink roots (from `$VIBE_CTL_DEV_PLUGINS`). Loaded as T3
   * with hot reload.
   */
  devPluginRoots?: string[];
  /** Canvas engine handle (wired by the shell, typed loosely for now). */
  canvasEngine: CanvasEngineHandle | unknown;
  /** Kernel-scoped logger. */
  logger: Logger;
  /** Semver string for this kernel build. Used for the version gate. */
  kernelVersion: string;
  /**
   * Persistent user-data dir (e.g. Electron's `app.getPath('userData')`).
   * Plugins receive per-id subdirs of this via ctx.dataDir.
   */
  userDataDir: string;
  /** Stable device identifier used by sync slices. */
  deviceId: string;
  /** Human-readable device name, surfaced to other peers. */
  deviceName: string;
  /** If true, skip the truffle NapiNode entirely (offline/selective sync). */
  offline?: boolean;
}

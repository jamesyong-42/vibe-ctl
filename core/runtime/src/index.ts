/**
 * Public entry point for `@vibe-ctl/runtime`. Intentionally narrow — the
 * runtime is consumed only by `@vibe-ctl/shell` and tests. Plugins talk to
 * the runtime via `ctx.*` façades from `@vibe-ctl/plugin-api`.
 */

export { Runtime } from './main-api/index.js';
export type { RuntimeOptions } from './main-api/index.js';
export type {
  PluginInfo,
  PluginState,
  PluginSource,
  DiscoveryResult,
  ResolutionResult,
  CanvasEngineHandle,
} from './types.js';

export * from './ecs/index.js';
export * from './ipc/index.js';
export * from './logging/index.js';

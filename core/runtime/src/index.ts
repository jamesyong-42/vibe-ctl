/**
 * Public entry point for `@vibe-ctl/runtime`. Intentionally narrow — the
 * runtime is consumed only by `@vibe-ctl/shell` and tests. Plugins talk to
 * the runtime via `ctx.*` façades from `@vibe-ctl/plugin-api`.
 */

export * from './ecs/index.js';
export * from './ipc/index.js';
export * from './logging/index.js';
export type { RuntimeOptions } from './main-api/index.js';
export { Runtime } from './main-api/index.js';
export type { CrashRecoveryOptions } from './plugin-host/crash-recovery.js';
export { CrashRecovery } from './plugin-host/crash-recovery.js';
export * from './registries/index.js';
export type { KernelDocName } from './sync/kernel-docs.js';

export { KERNEL_DOC_NAMES } from './sync/kernel-docs.js';
export type {
  CanvasEngineHandle,
  DiscoveryResult,
  PluginInfo,
  PluginSource,
  PluginState,
  ResolutionResult,
} from './types.js';

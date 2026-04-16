/**
 * Kernel ECS barrel. Re-exports world factory, components, tags, and systems.
 */

export { createKernelWorld } from './world.js';
export type { KernelWorld } from './world.js';

export {
  PermissionGrant,
  PluginDeps,
  PluginDisposables,
  PluginHealth,
  PluginInstance,
  PluginManifest,
  PluginModule,
  PluginPermissions,
  PluginProvidedServices,
  PluginRequiredServices,
  PluginSource,
  PluginState,
  PluginTier,
  ServiceEntry,
  WidgetType,
} from './components.js';

export { Disabled, Eager, Failed, NeedsUpdate } from './tags.js';

export {
  ActivationSystem,
  DeactivationSystem,
  DependencyResolutionSystem,
  DiscoverySystem,
  HealthMonitorSystem,
  SyncBridgeSystem,
} from './systems.js';

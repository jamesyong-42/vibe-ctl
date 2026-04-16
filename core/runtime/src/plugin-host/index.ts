/**
 * Plugin host (Layer 3). See spec 02 §8.
 */

export { discoverPlugins, readManifest } from './discovery.js';
export type { DiscoveryOptions, DiscoveredPlugin } from './discovery.js';

export { DependencyResolver } from './resolver.js';
export type { ResolverInput, ResolverOutput } from './resolver.js';

export { ActivationScheduler, ActivationSystem } from './activation.js';
export type { ActivationSchedulerOptions, ActivationSystemOptions } from './activation.js';

export { DeactivationSystem } from './deactivation.js';
export type { DeactivationSystemOptions } from './deactivation.js';

export { DisposableTracker } from './disposable-tracker.js';

export {
  ContextBuilder,
  getPluginAbortController,
  removePluginAbortController,
} from './context-builder.js';
export type { ContextBuilderOptions } from './context-builder.js';

export { HotReloader } from './hot-reloader.js';
export type { HotReloaderOptions } from './hot-reloader.js';

export { installPlugin, uninstallPlugin } from './module-resolver/install.js';
export type { InstallOptions } from './module-resolver/install.js';

export {
  HOST_PROVIDED_PACKAGES,
  buildHostImportMap,
  verifyNoHostProvidedBundling,
} from './module-resolver/import-map.js';
export type { HostProvidedPackage, ImportMap } from './module-resolver/import-map.js';

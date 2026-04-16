/**
 * Registries barrel. Re-exports service, command, and widget-type registries.
 */

export type { CommandDef } from './command-registry.js';
export { CommandRegistry } from './command-registry.js';
export type { ProvideOpts, ServiceEntryRecord } from './service-registry.js';
export { ServiceRegistry } from './service-registry.js';

export { WidgetTypeRegistry } from './widget-type-registry.js';

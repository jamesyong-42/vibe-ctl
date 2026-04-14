import type { Disposable } from '../disposable.js';
import type { PluginTier } from '../types.js';
import type { ServiceProxy } from './proxy.js';

/**
 * Options passed to `ctx.services.provide()`.
 */
export interface ProvideOpts {
  /**
   * If given, consumers see `isReady() === false` on the service until
   * this promise resolves. The kernel emits `service.ready` when it does.
   */
  warmup?: Promise<void>;
  /**
   * Restrict which plugin tiers can `require()` this service. Useful for
   * bundled services that shouldn't be callable by community plugins.
   */
  tierRestriction?: PluginTier;
}

/**
 * Declaration-merging surface for service typings. Each plugin's npm
 * package augments this interface so consumers get typed proxies:
 *
 *   declare module '@vibe-ctl/extension-api' {
 *     interface VibeServices {
 *       'claude-code': ClaudeCodeServiceV1;
 *       'terminal': TerminalServiceV1;
 *     }
 *   }
 *
 * Intentionally empty in the base definition so plugins can extend it
 * freely without conflicts.
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmentation surface; see doc comment.
export interface VibeServices {}

/**
 * The `ctx.services` surface. Backed by the kernel's service ECS
 * registry. Proxy semantics are enforced by the façade.
 */
export interface ServiceRegistry {
  /**
   * Register a service implementation. Returns a disposable that
   * invalidates all outstanding proxies when disposed.
   */
  provide<K extends keyof VibeServices>(
    id: K,
    impl: VibeServices[K],
    opts?: ProvideOpts,
  ): Disposable;
  provide<T>(id: string, impl: T, opts?: ProvideOpts): Disposable;

  /**
   * Require a service by id. Throws `ServiceUnresolved` if no provider
   * exists at call time. Prefer declaring a dependency in `manifest.dependencies`
   * so the kernel orders activation correctly.
   */
  require<K extends keyof VibeServices>(id: K): ServiceProxy<VibeServices[K]>;
  require<T>(id: string): ServiceProxy<T>;

  /**
   * Like `require()` but returns `null` if no provider exists. Useful
   * for `optionalDependencies`.
   */
  optional<K extends keyof VibeServices>(id: K): ServiceProxy<VibeServices[K]> | null;
  optional<T>(id: string): ServiceProxy<T> | null;
}

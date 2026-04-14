/**
 * ServiceRegistry. Spec 01 §7, spec 02 §11.2.
 *
 * Invariant: exactly one instance of each service, accessed through the
 * registry. `provide` registers an implementation; `require` / `optional`
 * hand out a service proxy (see spec 02 §8 "façade pattern").
 *
 * The proxy is a Proxy object that:
 *   - forwards calls while provider is active-ready;
 *   - throws `ServiceUnavailable` once the provider deactivates;
 *   - consults the PermissionManager on first call if the method is
 *     permission-gated;
 *   - throws `IncompatibleServiceVersion` on semver mismatch;
 *   - throws `ServiceAccessDenied` on tier restriction mismatch.
 *
 * When a provider is deactivated, the registry invalidates all handed-out
 * proxies synchronously by mutating a shared `invalidated` flag on the
 * proxy's closure. Proxy invalidation drives the `service.unavailable`
 * event.
 */

import type { Disposable, PluginTier } from '@vibe-ctl/plugin-api';

export interface ProvideOpts {
  warmup?: Promise<void>;
  tierRestriction?: PluginTier;
}

export interface ServiceEntry<T = unknown> {
  id: string;
  version: string;
  providerId: string;
  impl: T;
  warmup?: Promise<void>;
  tierRestriction?: PluginTier;
  ready: boolean;
  /** Handed-out proxies. Used for bulk invalidation on deactivate. */
  proxies: Set<unknown>;
}

export class ServiceRegistry {
  readonly #entries = new Map<string, ServiceEntry>();

  /** Register a service implementation. Returns a Disposable that removes it. */
  provide<T>(_id: string, _impl: T, _opts?: ProvideOpts, _providerId?: string): Disposable {
    throw new Error('not implemented: ServiceRegistry.provide');
  }

  /**
   * Require a service. Throws if the ID is not registered.
   *
   * TODO(runtime): wrap `impl` in a `Proxy` that checks the entry's
   * `ready` + `invalidated` flags on every access, and routes through the
   * PermissionManager for gated methods.
   */
  require<T>(_id: string, _consumerId: string, _consumerTier: PluginTier): T {
    throw new Error('not implemented: ServiceRegistry.require');
  }

  /** Like require, but returns null if the service is not registered. */
  optional<T>(_id: string, _consumerId: string, _consumerTier: PluginTier): T | null {
    throw new Error('not implemented: ServiceRegistry.optional');
  }

  /** Mark all services from a given provider as invalidated. */
  invalidateProvider(_providerId: string): void {
    throw new Error('not implemented: ServiceRegistry.invalidateProvider');
  }

  /** List all currently-registered services. */
  list(): ServiceEntry[] {
    return Array.from(this.#entries.values());
  }
}

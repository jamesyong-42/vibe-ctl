import type { Disposable } from '../disposable.js';

/**
 * A reactive proxy over a registered service. The façade preserves the
 * service's method types while adding lifecycle awareness:
 *
 *   - Calls forward to the provider while it's active.
 *   - Throws `ServiceUnavailable` if the provider has deactivated.
 *   - Emits `onUnavailable` so consumers can respond.
 *
 * Plugins consume services through this proxy — never through the
 * provider's concrete instance.
 */
export type ServiceProxy<T> = T & {
  /** True while the provider is active and warmup has completed. */
  readonly isAvailable: boolean;
  /** Subscribe to provider deactivation. */
  onUnavailable(cb: () => void): Disposable;
};

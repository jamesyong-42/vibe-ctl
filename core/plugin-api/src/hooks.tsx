import type { ServiceProxy } from './services/proxy.js';
import type { VibeServices } from './services/registry.js';
import type { UI } from './ui.js';

/**
 * React hooks used by widgets and other plugin UI code. These are
 * *type declarations plus stub implementations* — the real hooks are
 * swapped in by the kernel at runtime through a React context provider.
 *
 * Calling any of these outside a plugin host throws. This prevents
 * silent misuse in test harnesses where the runtime hasn't been set up.
 */

const MSG = (name: string): string =>
  `@vibe-ctl/plugin-api: ${name}() must be called inside a vibe-ctl plugin host. The runtime injects real implementations; the published package only ships stubs.`;

/**
 * Access the current widget's typed config. Returns the config and a
 * partial-update setter that writes back through `ctx.canvas`.
 */
export function useWidgetConfig<Config = unknown>(): [
  config: Config,
  setConfig: (patch: Partial<Config>) => void,
] {
  throw new Error(MSG('useWidgetConfig'));
}

/**
 * Access the owning plugin instance for widgets where `ownedByPlugin`
 * matches the current plugin. Direct reference, no façade, no permission
 * check. Throws from widgets whose plugin ownership doesn't match.
 */
export function useWidgetPlugin<P = unknown>(): P {
  throw new Error(MSG('useWidgetPlugin'));
}

/**
 * Access any plugin's service by id. Goes through the service proxy;
 * tier and permission checks apply.
 */
export function useService<K extends keyof VibeServices>(id: K): ServiceProxy<VibeServices[K]>;
export function useService<T>(id: string): ServiceProxy<T>;
export function useService(_id: string): unknown {
  throw new Error(MSG('useService'));
}

/**
 * Access the shared UI primitives. Equivalent to `ctx.ui` but usable
 * without holding a `ctx` reference.
 */
export function useUI(): UI {
  throw new Error(MSG('useUI'));
}

/** State reported by `useAsync`. */
export interface AsyncState<T> {
  loading: boolean;
  value: T | undefined;
  error: Error | undefined;
}

/**
 * Run an async thunk, re-running when `deps` change. Equivalent to a
 * lightweight `useEffect` + `useState` combo with loading/error state
 * and plugin-scoped cancellation.
 */
export function useAsync<T>(_thunk: () => Promise<T>, _deps?: readonly unknown[]): AsyncState<T> {
  throw new Error(MSG('useAsync'));
}

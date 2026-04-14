/**
 * Cross-half RPC for split plugins. Present only when the plugin
 * manifest declares `executionContext: 'split'`. The runtime wires a
 * typed MessagePort between the main-process half and the renderer
 * half; `ctx.rpc` is a Comlink-style façade over that channel.
 *
 * Usage:
 *
 *   // main.ts
 *   this.ctx.rpc!.expose({
 *     listProjects: () => api.getProjectList(),
 *     readTranscript: (id: string) => api.getSessionMessages(id),
 *   });
 *
 *   // renderer.ts
 *   const main = this.ctx.rpc!.connect<MainApi>();
 *   const projects = await main.listProjects();
 *
 * Every method on an exposed API returns a promise across the boundary
 * (regardless of its local signature), so `connect<T>()` returns the
 * "promisified" form of `T`.
 */

/**
 * Converts every method in `T` to its async-result equivalent. Non-promise
 * return types are wrapped in `Promise<...>`; promise-returning methods
 * are preserved.
 */
export type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? R extends Promise<unknown>
      ? (...args: A) => R
      : (...args: A) => Promise<R>
    : T[K] extends Promise<unknown>
      ? T[K]
      : Promise<T[K]>;
};

export interface PluginRPC {
  /**
   * Expose an API object from this half to the other half. Call once
   * per plugin half; subsequent calls replace the previous exposure.
   */
  expose<T extends object>(api: T): void;

  /**
   * Connect to the API exposed by the other half. Returns a Remote<T>
   * façade where every method returns a promise. Typed only when the
   * caller supplies the `T` generic.
   */
  connect<T extends object>(): Remote<T>;
}

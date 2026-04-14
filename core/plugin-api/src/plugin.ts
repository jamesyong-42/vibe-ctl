import type { PluginContext } from './context.js';

/**
 * Base class all plugins extend. The kernel injects `ctx` before
 * `onActivate()` is called. Do not touch `ctx` in the constructor —
 * it will be undefined.
 *
 * Minimal example:
 *
 *   export default class MyPlugin extends Plugin {
 *     async onActivate() {
 *       this.ctx.widgets.register({ ... });
 *     }
 *   }
 */
export abstract class Plugin {
  /**
   * Injected by the kernel before `onActivate()`. Do NOT use in the
   * constructor. Marked with `!` because the kernel sets it
   * out-of-band after instantiation.
   */
  readonly ctx!: PluginContext;

  /**
   * Called when the plugin activates. Register contributions here.
   * May be async — other plugins waiting on `waitForReady` see the
   * provided service as unready until this promise resolves and the
   * optional `warmup` passed to `services.provide()` also resolves.
   */
  abstract onActivate(): void | Promise<void>;

  /**
   * Optional. Called during deactivation AFTER tracked disposables
   * have been invoked. Use only for resources the tracker can't see
   * (native handles, external processes, child processes).
   */
  onDeactivate?(): void | Promise<void>;
}

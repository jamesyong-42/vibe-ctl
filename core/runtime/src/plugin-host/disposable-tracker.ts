/**
 * DisposableTracker. Spec 01 §11.
 *
 * Every `ctx.*.register()` call returns a Disposable, which the context
 * automatically forwards here. Plugin authors can also call
 * `ctx.track(d)` for resources the tracker can't see (native handles,
 * external processes).
 *
 * On deactivation, disposables run in REVERSE registration order so
 * later-registered resources (often depending on earlier ones) tear down
 * first.
 */

import type { Disposable } from '@vibe-ctl/extension-api';

export class DisposableTracker {
  /** Per-plugin stack of disposables, newest last. */
  readonly #byPlugin = new Map<string, Disposable[]>();

  /** Record a disposable under a plugin. Called by the context scope. */
  track(pluginId: string, d: Disposable): Disposable {
    const stack = this.#byPlugin.get(pluginId) ?? [];
    stack.push(d);
    this.#byPlugin.set(pluginId, stack);
    return d;
  }

  /**
   * Dispose every tracked disposable for a plugin in reverse registration
   * order. Each dispose runs inside a try/catch so one failure does not
   * prevent the rest from running. Errors are collected and returned.
   */
  async disposeAll(_pluginId: string): Promise<Error[]> {
    throw new Error('not implemented: DisposableTracker.disposeAll');
  }

  /** Number of tracked disposables for a plugin. */
  count(pluginId: string): number {
    return this.#byPlugin.get(pluginId)?.length ?? 0;
  }
}

/**
 * Renderer-side bootstrap hook. Called once from `entry.client.tsx`
 * before React mounts. Today it's a passthrough; as the runtime
 * wiring lands this owns:
 *
 *   - Subscribing to main-process lifecycle events (boot-complete,
 *     plugin-loaded, version-gate) via the preload IPC surface.
 *   - Warming any renderer-side caches (IDB, theme tokens) that the
 *     very first paint depends on.
 *
 * The canvas engine is NOT constructed here — it belongs to
 * `MainScreen` since only that screen uses it. Keeping boot.ts
 * cross-screen maintains the rule that `app/` is for concerns shared
 * by every screen.
 */

export interface BootResult {
  /** True once main-process boot tasks and version checks complete. */
  ready: boolean;
}

export async function bootRenderer(): Promise<BootResult> {
  // TODO(runtime-ipc): await `window.__vibeCtl.runtime.waitForReady()`
  // once the preload surface is wired.
  return { ready: true };
}

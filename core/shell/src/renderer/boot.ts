/**
 * Renderer-side runtime initialisation.
 *
 * The main-process Runtime owns the kernel ECS world, sync fabric, and
 * plugin host. The renderer side's job is:
 *
 *   1. Construct the canvas engine (`@vibe-ctl/canvas`) and hand it back
 *      to the main process so the canvas-sync adapter can bind.
 *   2. Subscribe to reactive ECS queries for the placements we render.
 *   3. Mount plugin-contributed widgets into their declared placements.
 *
 * Stub: nothing wires up end-to-end yet. The function exists so
 * `main.tsx` has a stable hook point.
 */

export async function bootRenderer(): Promise<void> {
  // TODO:
  //   const engine = createCanvasEngine({ ... });
  //   await window.__vibeCtl.canvas.attach(engine.handle);
  //   const pluginQuery = runtime.world.query([PluginManifest, PluginState]);
  //   pluginQuery.subscribe((plugins) => ...);
}

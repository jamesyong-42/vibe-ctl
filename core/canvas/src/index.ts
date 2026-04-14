/**
 * Public surface of `@vibe-ctl/canvas`.
 *
 * Consumed by `@vibe-ctl/runtime` (kernel plumbing) and the desktop
 * shell. Plugin authors do not import from this package directly;
 * widget primitives reach them via `ctx.ui` and placements are mounted
 * by the shell.
 */

// ─── Engine ─────────────────────────────────────────────────────────
export {
  KernelCanvasEngine,
  type InfiniteCanvasEngine,
  type KernelCanvasEngineOptions,
} from './engine.js';

// ─── Widget type registry ───────────────────────────────────────────
export {
  WidgetTypeRegistry,
  type WidgetTypeChange,
  type WidgetTypeEntry,
  type WidgetTypeId,
  type WidgetTypeListener,
} from './widget-type-registry.js';

// ─── Canvas sync adapter ────────────────────────────────────────────
export {
  CanvasSyncAdapter,
  type CanvasSyncAdapterOptions,
  type CrdtDocLike,
} from './canvas-sync-adapter.js';

// ─── Missing-plugin placeholder ─────────────────────────────────────
export {
  MissingPluginPlaceholder,
  type MissingPluginPlaceholderProps,
} from './missing-plugin-placeholder.js';

// ─── UI primitives (ctx.ui.* at runtime) ────────────────────────────
export * from './ui-primitives/index.js';

// ─── Placement slots ────────────────────────────────────────────────
export * from './placements/index.js';

/**
 * Public surface of `@vibe-ctl/canvas`.
 *
 * Renderer-agnostic: engine wrapper, CRDT sync adapter, widget-type
 * registry. Zero React / DOM. Consumed by `@vibe-ctl/runtime` and by
 * whatever shell is hosting (`@vibe-ctl/shell` today, a web shell
 * tomorrow). UI primitives live in `@vibe-ctl/ui`.
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

/**
 * Public surface of `@vibe-ctl/ui`.
 *
 * Portable React design system: `ctx.ui.*` primitives, layout slots,
 * and the missing-plugin placeholder. Consumed by whatever shell is
 * hosting the app (desktop today, web tomorrow). Plugins never import
 * from here directly — they reach these via `ctx.ui` at runtime.
 */

// ─── Icon catalog ───────────────────────────────────────────────────
export * from './icons/index.js';
// ─── Layout slots (placement mount points) ──────────────────────────
export * from './layout/index.js';
// ─── Placeholders ───────────────────────────────────────────────────
export {
  MissingPluginPlaceholder,
  type MissingPluginPlaceholderProps,
} from './placeholders/MissingPluginPlaceholder.js';
// ─── ctx.ui primitives ──────────────────────────────────────────────
export * from './primitives/index.js';

/**
 * @vibe-ctl/desktop — thin packaging shell.
 *
 * All runtime logic lives in `@vibe-ctl/shell` (main, preload, renderer).
 * electron-builder points at `../../core/shell/out/main/index.js` as the
 * Electron main entry — see `package.json > main`.
 *
 * This file exists for two reasons:
 *   1. It gives `tsc --noEmit` a root file so typecheck works.
 *   2. It re-exports the shell's public types so downstream packaging
 *      scripts (e.g. custom `afterPack` hooks) can type them.
 */

// Re-export is a compile-time-only concern; the actual main bundle is
// produced by electron-vite in `@vibe-ctl/shell`.
export type {} from '@vibe-ctl/shell';

#!/usr/bin/env node
/**
 * Build the Electron preload as CommonJS.
 *
 * Electron's sandboxed preload loader only executes CJS. electron-vite v5
 * forces the preload to ESM `.mjs` when package.json is `type: module` and
 * silently ignores user-level format overrides — so we sidestep it entirely
 * and build the preload with esbuild here.
 *
 * Usage: `node scripts/build-preload.mjs [--watch]`
 */

import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const watch = process.argv.includes('--watch');

/**
 * Output to `out/preload-cjs/` — a directory electron-vite doesn't manage
 * so its own preload step (which emits ESM `.mjs` into `out/preload/`)
 * doesn't empty our CJS artifact during incremental rebuilds.
 *
 * @type {import('esbuild').BuildOptions}
 */
const config = {
  entryPoints: [`${__dirname}/../src/preload/index.ts`],
  outfile: `${__dirname}/../out/preload-cjs/index.js`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: true,
  external: ['electron'],
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[preload] watching src/preload/');
} else {
  await esbuild.build(config);
  console.log('[preload] built out/preload/index.js');
}

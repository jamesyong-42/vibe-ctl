/**
 * Shared `webPreferences` baseline for every BrowserWindow we create
 * (spec 05 §4.1, §14 invariant 3).
 *
 * One source of truth so there's no code path that accidentally
 * constructs a window with Node integration on or sandbox off.
 *
 * The preload is the esbuild-emitted CJS artifact under `out/preload-cjs/`.
 * See the comment in `scripts/build-preload.mjs` for why this lives
 * outside electron-vite's preload step.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the esbuild-emitted CJS preload script. */
export const PRELOAD_PATH = join(__dirname, '../../preload-cjs/index.js');

export const SECURE_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  webviewTag: false,
  spellcheck: false,
  additionalArguments: [] as string[],
} as const;

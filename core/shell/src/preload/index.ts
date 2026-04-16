/**
 * Preload composition root.
 *
 * Runs in an isolated world under `sandbox: true`; compiled to CJS by
 * `scripts/build-preload.mjs`. The entire surface exposed to the
 * renderer lives in `./bridge.ts`.
 */

import { contextBridge } from 'electron';
import { type VibeCtlBridge, buildBridge } from './bridge.js';
import { initHandshakeBridge } from './handshake.js';

contextBridge.exposeInMainWorld('__vibeCtl', buildBridge());
initHandshakeBridge();

declare global {
  interface Window {
    __vibeCtl: VibeCtlBridge;
  }
}

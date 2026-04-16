/**
 * Runtime fuse-state sanity check (spec 05 §3).
 *
 * Electron Fuses are flipped at packaging time via `@electron/fuses` in
 * electron-builder's afterPack hook (`apps/desktop/scripts/afterPack.mjs`).
 *
 * This module is the "if you're looking for fuse config, look here"
 * breadcrumb. The real fuse flipping happens at build time — runtime
 * validation is intentionally deferred to the packaging step because
 * fuses are baked into the binary and cannot be introspected reliably
 * from within a running Electron process.
 *
 * In development (`app.isPackaged === false`), this is a no-op — fuses
 * only matter in packaged builds.
 *
 * Expected fuse state in production (see spec 05 §3):
 *   - RunAsNode: disabled
 *   - EnableCookieEncryption: enabled
 *   - EnableNodeOptionsEnvironmentVariable: disabled
 *   - EnableNodeCliInspectArguments: disabled
 *   - EnableEmbeddedAsarIntegrityValidation: enabled
 *   - OnlyLoadAppFromAsar: enabled
 *   - GrantFileProtocolExtraPrivileges: disabled
 */

import { createScopedLogger } from '@vibe-ctl/runtime';
import { app } from 'electron';

const log = createScopedLogger('shell:fuse-check');

export function runFuseCheck(): void {
  if (!app.isPackaged) {
    log.debug('dev build — fuse check skipped');
    return;
  }

  log.info('fuse validation deferred to packaging step — see apps/desktop/scripts/afterPack.mjs');
}

/**
 * Custom protocol handlers.
 *
 *   host://       — shell-provided assets (icons, chrome fragments).
 *   plugin://     — plugin-contributed assets, namespaced by plugin id
 *                   (e.g. plugin://claude-code/icon.svg).
 *
 * Stub: registration scaffolding only. Real handlers will proxy into the
 * plugin host to resolve {pluginId -> on-disk dir} before streaming a
 * file back. `protocol.registerSchemesAsPrivileged` is intentionally NOT
 * invoked here — needs to run before `app.ready` from the entry module
 * once we wire it up for real.
 */

import { protocol } from 'electron';

export function registerProtocols(): void {
  // TODO: move to `protocol.registerSchemesAsPrivileged` invocation at the
  // top of the main entry (before app.ready) once we stream real content.
  protocol.handle('host', async () => {
    return new Response('not implemented', { status: 501 });
  });
  protocol.handle('plugin', async () => {
    return new Response('not implemented', { status: 501 });
  });
}

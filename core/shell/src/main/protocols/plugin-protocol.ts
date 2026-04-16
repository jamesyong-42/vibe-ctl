/**
 * `plugin:` protocol handler (spec 05 §7.2).
 *
 * Serves plugin-contributed assets, namespaced by plugin id.
 *
 * URL shape: `plugin://{pluginId}/{pathRelativeToPluginDist}`
 *
 * The handler:
 *   1. Extracts `pluginId` from the URL hostname.
 *   2. Resolves the asset path relative to the plugin's dist dir.
 *   3. **Path-traversal guard**: after `path.resolve()`, verifies the
 *      resolved path starts with the plugin's base dir. Returns 403 if
 *      it escapes.
 *   4. Returns 404 for missing files with a clear error.
 *
 * Plugins never write to `plugin:` — it's read-only. Writable storage
 * goes through `ctx.storage.*`.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createScopedLogger } from '@vibe-ctl/runtime';
import { app, protocol } from 'electron';
import { mimeForPath } from './mime.js';

const log = createScopedLogger('shell:protocol:plugin');

export function registerPluginProtocol(): void {
  protocol.handle('plugin', async (req) => {
    try {
      const url = new URL(req.url);
      const pluginId = url.hostname;

      if (!pluginId) {
        return new Response('Bad Request: missing plugin id', { status: 400 });
      }

      // Resolve the plugin's base directory. User-installed plugins
      // live under `{userData}/plugins/{pluginId}`. Built-in plugins
      // are resolved from resources at runtime; for now this covers
      // the user-installed path.
      const pluginBase = resolve(join(app.getPath('userData'), 'plugins', pluginId));
      const filePath = resolve(pluginBase, `.${url.pathname}`);

      // Path-traversal guard: resolved path must stay inside pluginBase.
      if (!filePath.startsWith(pluginBase)) {
        log.warn({ url: req.url, pluginId, filePath }, 'path traversal blocked');
        return new Response('Forbidden', { status: 403 });
      }

      const body = await readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': mimeForPath(filePath) },
      });
    } catch (err) {
      log.debug({ url: req.url, err }, 'plugin: asset not found');
      return new Response('Not Found', { status: 404 });
    }
  });
}

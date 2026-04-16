/**
 * `host:` protocol handler (spec 05 §7.1).
 *
 * Serves shell-owned assets (renderer HTML/JS/CSS/images) from the
 * packaged ASAR in production. In dev mode this handler is rarely hit
 * because Vite serves everything, but it must work for production.
 *
 * URL shape: `host:/index.html`, `host:/assets/main.js`, etc.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createScopedLogger } from '@vibe-ctl/runtime';
import { app, protocol } from 'electron';
import { mimeForPath } from './mime.js';

const log = createScopedLogger('shell:protocol:host');

export function registerHostProtocol(): void {
  protocol.handle('host', async (req) => {
    try {
      const url = new URL(req.url);
      // Resolve against the renderer output dir inside the ASAR.
      const basePath = resolve(app.getAppPath(), 'out', 'renderer');
      // URL pathname starts with `/`; resolve strips it naturally.
      const filePath = resolve(basePath, `.${url.pathname}`);

      // Path-traversal guard: resolved path must stay inside basePath.
      if (!filePath.startsWith(basePath)) {
        log.warn({ url: req.url, filePath }, 'path traversal blocked');
        return new Response('Forbidden', { status: 403 });
      }

      const body = await readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': mimeForPath(filePath) },
      });
    } catch (err) {
      log.debug({ url: req.url, err }, 'host: asset not found');
      return new Response('Not Found', { status: 404 });
    }
  });
}

/**
 * Session-level security hardening.
 *
 * Runs once after `app.whenReady()` against the default session. Three
 * concerns:
 *
 *   1. Permission requests — deny by default, opt-in via allowlist.
 *   2. Content-Security-Policy — inject a strict response header on
 *      navigations served over our privileged schemes (host:, plugin:,
 *      file:). Defense-in-depth alongside the <meta> tag in index.html;
 *      the header wins if the two disagree.
 *   3. Attach/navigate on other sessions — handled per-window by
 *      `./navigation.ts`; security.ts only owns session-scoped concerns.
 */

import { type Session, session } from 'electron';

/**
 * Permissions the renderer is allowed to request on its own. Everything
 * else is denied outright; plugins that need sensitive capabilities go
 * through `ctx.permissions.*` which performs an explicit user prompt.
 */
const ALLOWED_PERMISSIONS = new Set<string>(['clipboard-sanitized-write', 'notifications']);

/**
 * Build the CSP for the current process mode.
 *
 * Production: strict — no inline scripts, no eval, no external origins.
 *
 * Dev: carve out the three things Vite's HMR runtime needs and nothing
 *   else:
 *     - `'unsafe-inline'` on `script-src` so Vite's preamble injection
 *       (`<script>` nodes rewritten by @vitejs/plugin-react) can execute
 *     - `'unsafe-eval'` on `script-src` so Vite's client can eval HMR
 *       payloads
 *     - the dev server origin on `script-src` and `connect-src` so the
 *       renderer can fetch modules and open the HMR WebSocket
 *
 * `ELECTRON_RENDERER_URL` is set by electron-vite in dev and absent in
 * packaged builds, so it's a reliable mode switch.
 */
function buildCsp(): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const wsUrl = devUrl?.replace(/^http/, 'ws');

  const scriptSrc = devUrl ? `'self' 'unsafe-inline' 'unsafe-eval' ${devUrl}` : "'self'";
  const connectSrc = devUrl ? `'self' ${devUrl} ${wsUrl}` : "'self'";

  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': scriptSrc,
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: blob: host: plugin:",
    'font-src': "'self' data:",
    'connect-src': connectSrc,
    'media-src': "'self' blob: host: plugin:",
    'worker-src': "'self' blob:",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'frame-ancestors': "'none'",
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join('; ');
}

export function setupSecurity(target: Session = session.defaultSession): void {
  target.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  target.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission),
  );

  const csp = buildCsp();
  target.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') delete headers[key];
    }
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
}

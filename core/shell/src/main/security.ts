/**
 * Session-level security hardening.
 *
 * Runs once after `app.whenReady()` against the default session. Two
 * concerns owned here:
 *
 *   1. Permission requests — deny by default, opt-in via allowlist.
 *   2. Content-Security-Policy — inject a strict response header on
 *      navigations served over our privileged schemes (host:, plugin:,
 *      file:). Defense-in-depth alongside the <meta> tag in index.html;
 *      the header wins if the two disagree.
 *
 * CSP construction delegated to `./security/csp.ts`.
 */

import { type Session, session } from 'electron';
import { buildCsp } from './security/csp.js';

/**
 * Permissions the renderer is allowed to request on its own. Everything
 * else is denied outright; plugins that need sensitive capabilities go
 * through `ctx.permissions.*` which performs an explicit user prompt.
 */
const ALLOWED_PERMISSIONS = new Set<string>(['clipboard-sanitized-write', 'notifications']);

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

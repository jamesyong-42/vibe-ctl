/**
 * Session-level security hardening.
 *
 * Runs once after `app.whenReady()` against the default session. Two
 * concerns:
 *
 *   1. Permission requests — delegated to `./security/permissions.ts`.
 *   2. Content-Security-Policy — inject a strict response header;
 *      delegated to `./security/csp.ts`.
 */

import { type Session, session } from 'electron';
import { buildCsp } from './security/csp.js';
import { setupPermissionHandlers } from './security/permissions.js';

export function setupSecurity(target: Session = session.defaultSession): void {
  setupPermissionHandlers(target);

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

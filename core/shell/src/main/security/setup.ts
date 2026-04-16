/**
 * Session security setup (spec 05 §8).
 *
 * Single entry point that applies all session-scoped hardening:
 *
 *   1. Chromium permission handlers (deny-by-default allowlist).
 *   2. CSP response header injection (strips any existing CSP first).
 *
 * Called once against `session.defaultSession` during boot. Also called
 * for ephemeral sessions (detached windows) so they inherit the same
 * policy.
 */

import { type Session, session } from 'electron';
import { buildCsp } from './csp.js';
import { setupPermissionHandlers } from './permissions.js';

export function setupSessionSecurity(target: Session = session.defaultSession): void {
  setupPermissionHandlers(target);

  const csp = buildCsp();
  target.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    // Strip any existing CSP headers — our header is authoritative and
    // overrides any <meta http-equiv="Content-Security-Policy"> tag.
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') delete headers[key];
    }
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });
}

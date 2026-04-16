/**
 * Chromium-level permission handlers (spec 05 §8.2).
 *
 * Deny-by-default allowlist for the Chromium permission system. Only
 * `clipboard-sanitized-write` and `notifications` are permitted. Every
 * other Chromium capability — camera, mic, geolocation, persistent
 * storage, midi, HID, serial, USB, Bluetooth — is denied outright.
 *
 * This is distinct from the plugin-level `ctx.permissions` system
 * (spec 01 §9): those go through kernel IPC and a user-facing modal,
 * not through Chromium's built-in permission prompt.
 */

import type { Session } from 'electron';

/**
 * Permissions the renderer is allowed to request. Everything else is
 * denied; plugins that need sensitive capabilities go through
 * `ctx.permissions.require(…)` which performs an explicit user prompt.
 */
export const ALLOWED_PERMISSIONS: ReadonlySet<string> = new Set([
  'clipboard-sanitized-write',
  'notifications',
]);

export function setupPermissionHandlers(session: Session): void {
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  session.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission),
  );
}

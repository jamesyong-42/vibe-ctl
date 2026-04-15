/**
 * IPC host-method contract.
 *
 * `HostMethod` is the closed enum of renderer→main request/response
 * methods. Every method is dispatched over the single
 * `'vibe-ctl:host'` `ipcMain.handle` channel with payload
 * `{ method, args }` (see spec 05 §6.1).
 *
 * The shape here is intentionally minimal — commit 4 wires
 * `HostRequest<M>` / `HostResponse<M>` to the Zod schemas in
 * `./schemas/` via `z.infer`, making the schemas the source of truth.
 * Until then, both sides resolve to `unknown` so importers fail loudly.
 */

export type HostMethod =
  | 'plugins.list'
  | 'plugins.enable'
  | 'plugins.disable'
  | 'plugins.install'
  | 'settings.read'
  | 'settings.write'
  | 'windows.detachWidget'
  | 'windows.closeDetached'
  | 'updater.check'
  | 'updater.install'
  | 'updater.defer'
  | 'permissions.respond'
  | 'permissions.revoke'
  | 'system.platform'
  | 'system.openExternal'
  | 'system.ping';

// Replaced in commit 4 with `z.infer<(typeof hostSchemas)[M]['request']>`.
export type HostRequest<M extends HostMethod> = M extends HostMethod ? unknown : never;

// Replaced in commit 4 with `z.infer<(typeof hostSchemas)[M]['response']>`.
export type HostResponse<M extends HostMethod> = M extends HostMethod ? unknown : never;

/** Fixed channel name for the host dispatcher (spec 05 §6.1). */
export const HOST_CHANNEL = 'vibe-ctl:host' as const;

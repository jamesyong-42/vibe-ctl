/**
 * IPC host-method contract.
 *
 * `HostMethod` is the closed enum of renderer→main request/response
 * methods. Every method is dispatched over the single
 * `'vibe-ctl:host'` `ipcMain.handle` channel with payload
 * `{ method, args }` (see spec 05 §6.1).
 *
 * `HostRequest<M>` and `HostResponse<M>` are inferred from the Zod
 * schemas in `./schemas/index.ts`, making the schemas the single source
 * of truth for wire shapes.
 */

import type { z } from 'zod';
import type { hostSchemas } from './schemas/index.js';

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

export type HostRequest<M extends HostMethod> = z.infer<(typeof hostSchemas)[M]['request']>;

export type HostResponse<M extends HostMethod> = z.infer<(typeof hostSchemas)[M]['response']>;

/** Fixed channel name for the host dispatcher (spec 05 §6.1). */
export const HOST_CHANNEL = 'vibe-ctl:host' as const;

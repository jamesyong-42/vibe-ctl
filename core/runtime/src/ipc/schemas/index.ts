import type { ZodTypeAny } from 'zod';
import type { HostMethod } from '../contract.js';
import { permissionsSchemas } from './permissions.js';
import { pluginsSchemas } from './plugins.js';
import { settingsSchemas } from './settings.js';
import { systemSchemas } from './system.js';
import { updaterSchemas } from './updater.js';
import { windowsSchemas } from './windows.js';

/**
 * Source-of-truth schema map for every host method. Used by:
 *   - the main-side dispatcher, to validate incoming `args` before
 *     invoking the handler
 *   - the `HostRequest<M>` / `HostResponse<M>` type inference in
 *     `../contract.ts`
 */
export const hostSchemas = {
  ...systemSchemas,
  ...pluginsSchemas,
  ...settingsSchemas,
  ...windowsSchemas,
  ...updaterSchemas,
  ...permissionsSchemas,
} as const satisfies Record<HostMethod, { request: ZodTypeAny; response: ZodTypeAny }>;

export type HostSchemas = typeof hostSchemas;

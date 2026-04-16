/**
 * Host-method dispatcher (spec 05 §6.1).
 *
 * Single `ipcMain.handle('vibe-ctl:host', …)` channel. Payloads are
 * `{ method, args }`; the dispatcher looks `method` up in a frozen map,
 * validates `args` against the Zod schema in `hostSchemas`, invokes the
 * handler, validates the response on the way out, and returns.
 *
 * Unknown or not-yet-implemented methods throw a `MethodNotImplemented`
 * error (surfaced as a rejected promise on the renderer side). Phase 1
 * wires only `system.ping`, `system.platform`, and `system.openExternal`.
 */

import {
  HOST_CHANNEL,
  type HostMethod,
  type HostRequest,
  type HostResponse,
  createScopedLogger,
  hostSchemas,
} from '@vibe-ctl/runtime';
import { ipcMain } from 'electron';
import { handleOpenExternal, handlePing, handlePlatform } from './handlers/system.js';

const log = createScopedLogger('shell:ipc:host-dispatcher');

type Handler<M extends HostMethod> = (args: HostRequest<M>) => Promise<HostResponse<M>>;

/** Stub thrown for host methods that aren't wired yet. */
class MethodNotImplemented extends Error {
  constructor(method: string) {
    super(`host method not implemented yet: ${method}`);
    this.name = 'MethodNotImplemented';
  }
}

async function notImplemented(_args: unknown): Promise<never> {
  throw new MethodNotImplemented('(see request)');
}

const handlers: { [M in HostMethod]: Handler<M> } = {
  'system.ping': handlePing,
  'system.platform': handlePlatform,
  'system.openExternal': handleOpenExternal,
  'plugins.list': notImplemented as Handler<'plugins.list'>,
  'plugins.enable': notImplemented as Handler<'plugins.enable'>,
  'plugins.disable': notImplemented as Handler<'plugins.disable'>,
  'plugins.install': notImplemented as Handler<'plugins.install'>,
  'settings.read': notImplemented as Handler<'settings.read'>,
  'settings.write': notImplemented as Handler<'settings.write'>,
  'windows.detachWidget': notImplemented as Handler<'windows.detachWidget'>,
  'windows.closeDetached': notImplemented as Handler<'windows.closeDetached'>,
  'updater.check': notImplemented as Handler<'updater.check'>,
  'updater.install': notImplemented as Handler<'updater.install'>,
  'updater.defer': notImplemented as Handler<'updater.defer'>,
  'permissions.respond': notImplemented as Handler<'permissions.respond'>,
  'permissions.revoke': notImplemented as Handler<'permissions.revoke'>,
};

export function registerHostDispatcher(): void {
  ipcMain.handle(HOST_CHANNEL, async (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object' || !('method' in raw)) {
      throw new Error('host: malformed request envelope');
    }
    const { method, args } = raw as { method: HostMethod; args: unknown };
    const schema = hostSchemas[method];
    if (!schema) {
      throw new Error(`host: unknown method '${method}'`);
    }
    const parsed = schema.request.safeParse(args);
    if (!parsed.success) {
      log.warn({ method, issues: parsed.error.issues }, 'args validation failed');
      throw new Error(`host: invalid args for '${method}'`);
    }
    const handler = handlers[method];
    const result = await handler(parsed.data as never);
    const out = schema.response.safeParse(result);
    if (!out.success) {
      log.error({ method, issues: out.error.issues }, 'response validation failed');
      throw new Error(`host: invalid response for '${method}'`);
    }
    return out.data;
  });
}

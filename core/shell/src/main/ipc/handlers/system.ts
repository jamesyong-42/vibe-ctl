/**
 * Handlers for the `system.*` host methods (spec 05 §6.1).
 *
 * Phase-1 scope:
 *   - system.ping → noop round-trip; smoke-tests renderer → main IPC
 *   - system.platform → process.platform (narrowed to the enum)
 *   - system.openExternal → delegates to electron.shell.openExternal
 */

import type { HostRequest, HostResponse } from '@vibe-ctl/runtime';
import { shell } from 'electron';

export async function handlePing(
  _args: HostRequest<'system.ping'>,
): Promise<HostResponse<'system.ping'>> {
  return { pong: true as const, ts: Date.now() };
}

export async function handlePlatform(
  _args: HostRequest<'system.platform'>,
): Promise<HostResponse<'system.platform'>> {
  const plat = process.platform;
  if (plat === 'darwin' || plat === 'linux' || plat === 'win32') return plat;
  throw new Error(`unsupported platform: ${plat}`);
}

export async function handleOpenExternal(
  args: HostRequest<'system.openExternal'>,
): Promise<HostResponse<'system.openExternal'>> {
  await shell.openExternal(args.url);
}

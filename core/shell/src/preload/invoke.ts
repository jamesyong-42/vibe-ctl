/**
 * Typed `invoke()` wrapper around `ipcRenderer.invoke('vibe-ctl:host', …)`
 * (spec 05 §5.1, §6.1).
 *
 * The renderer-side `HostMethod`/`HostRequest`/`HostResponse` types are
 * imported `type`-only so esbuild erases them from the CJS preload
 * bundle — no runtime dep on `@vibe-ctl/runtime` from the preload.
 */

import type { HostMethod, HostRequest, HostResponse } from '@vibe-ctl/runtime';
import { ipcRenderer } from 'electron';

const HOST_CHANNEL = 'vibe-ctl:host' as const;

export function invoke<M extends HostMethod>(
  method: M,
  payload: HostRequest<M>,
): Promise<HostResponse<M>> {
  return ipcRenderer.invoke(HOST_CHANNEL, { method, args: payload });
}

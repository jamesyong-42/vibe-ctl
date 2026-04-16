/**
 * Typed hook over `HostBridge.invoke` (spec 05 §6.1).
 *
 * Throws if called outside `<HostBridgeProvider>` — that's a programmer
 * error, not a runtime condition, so no fallback.
 */

import type { HostMethod, HostRequest, HostResponse } from '@vibe-ctl/runtime';
import { useContext } from 'react';
import { HostBridgeContext } from './HostBridgeProvider.js';

export function useHostInvoke(): <M extends HostMethod>(
  method: M,
  args: HostRequest<M>,
) => Promise<HostResponse<M>> {
  const bridge = useContext(HostBridgeContext);
  if (!bridge) {
    throw new Error('useHostInvoke: HostBridgeProvider not mounted');
  }
  return bridge.invoke;
}

export function useHostBridge() {
  const bridge = useContext(HostBridgeContext);
  if (!bridge) {
    throw new Error('useHostBridge: HostBridgeProvider not mounted');
  }
  return bridge;
}

/**
 * Nullable variant for components that need to render before the bridge
 * is ready (boot screen, error boundary).
 */
export function useHostBridgeOptional() {
  return useContext(HostBridgeContext);
}

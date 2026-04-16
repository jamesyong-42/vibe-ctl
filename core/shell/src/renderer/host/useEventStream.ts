/**
 * `useEvent` — subscribe a handler to a specific kernel event type.
 *
 * Unlike `useEventSnapshot`, this never causes the component to
 * re-render: the handler is called imperatively on each delivery. Good
 * for wiring up side-effects (e.g. toasts, animations).
 */

import type { VibeEvents } from '@vibe-ctl/runtime';
import { useEffect } from 'react';
import { useHostBridge } from './useHostInvoke.js';

export function useEvent<E extends keyof VibeEvents>(
  type: E,
  handler: (payload: VibeEvents[E]) => void,
): void {
  const bridge = useHostBridge();
  useEffect(() => {
    const port = bridge.eventPort;
    const onMessage = (ev: MessageEvent): void => {
      const data = ev.data as {
        type: keyof VibeEvents;
        payload: VibeEvents[keyof VibeEvents];
      } | null;
      if (!data || typeof data !== 'object' || !('type' in data)) return;
      if (data.type === type) handler(data.payload as VibeEvents[E]);
    };
    port.addEventListener('message', onMessage);
    return () => {
      port.removeEventListener('message', onMessage);
    };
  }, [bridge.eventPort, type, handler]);
}
